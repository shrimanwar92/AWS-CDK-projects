import {IRepository} from "@aws-cdk/aws-ecr";
import {ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";
import {
    Cluster,
    ContainerImage,
    FargateService,
    FargateTaskDefinition,
    LogDrivers,
    ContainerDefinition,
    ICluster,
} from "@aws-cdk/aws-ecs";
import {
    IApplicationListener,
    CfnListenerRule,
    ApplicationTargetGroup
} from '@aws-cdk/aws-elasticloadbalancingv2';
import {Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {Duration, Stack} from "@aws-cdk/core";
import {STACK_NAME, CONTAINER} from "./utils";
import AppAutoScaling from "./autoscaling";

export interface ContainerProps {
    vpc: IVpc,
    repository: IRepository,
    loadBalancerSecurityGroup: ISecurityGroup,
    listener: IApplicationListener
}

export default class Container {
    readonly stack: Stack;
    readonly props: ContainerProps;
    taskDefinition: FargateTaskDefinition;
    taskRole: Role;
    container: ContainerDefinition;
    fargateService: FargateService;

    private cluster: ICluster;

    constructor(stack: Stack, props: ContainerProps) {
        this.stack = stack;
        this.props = props;
    }

    createFromRepository() {
        // create task role
        // create task definition
        // create container
        // create fargateService
        // setup application autoscaling
        return this.createTaskRole()
            .createTaskDefinition()
            .addContainer()
            .startFargateService()
            .setupAutoScaling();
    }

    private createTaskRole(): Container {
        this.taskRole =  new Role(this.stack, `task-role`, {
            roleName: `${STACK_NAME}-task-role`,
            assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
        });
        this.props.repository.grantPull(this.taskRole);

        return this;
    }

    private createTaskDefinition() {
        this.taskDefinition = new FargateTaskDefinition(this.stack, `task-def`, {
            family: `${STACK_NAME}-task-def`,
            taskRole: this.taskRole,
            executionRole: this.taskRole
        });

        return this;
    }

    private addContainer() {
        this.container = this.taskDefinition.addContainer(`container`, {
            image: ContainerImage.fromEcrRepository(this.props.repository),
            containerName: CONTAINER.NAME,
            logging: LogDrivers.awsLogs({ streamPrefix: `${STACK_NAME}-log` }),
            entryPoint: ["node", "server.js"],
            workingDirectory: "/app",
            secrets: {
                //ConnectionStrings__DefaultConnection: Secret.fromSsmParameter(props.parameter)
            },
            environment: {
                TEST: "my name is ..."
            }
        });
        this.container.addPortMappings({containerPort: CONTAINER.PORT, hostPort: CONTAINER.PORT});
        return this;
    }

    private startFargateService() {
        this.fargateService = new FargateService(this.stack, `fargate-service`, {
            serviceName: `${STACK_NAME}-fargate-service`,
            cluster: this.createCluster(),
            taskDefinition: this.taskDefinition,
            desiredCount: 1,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE
            }
        });

        // allow traffic from load balancer to container
        this.fargateService.connections.allowFrom(this.props.loadBalancerSecurityGroup, Port.tcp(CONTAINER.PORT), "allow traffic from Lb security group to container port");

        // allow container to pull ECR image
        const defaultFargateSecurityGroup = this.fargateService.connections.securityGroups[0];
        const fargateSecurityGroup = SecurityGroup.fromSecurityGroupId(this.stack, 'import-fargate-sg', defaultFargateSecurityGroup.securityGroupId);
        fargateSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "allow container to pull ecr image");

        // allow traffic from container to database
        //this.props.databaseSecurityGroup.connections.allowFrom(fargateSecurityGroup, Port.tcp(DATABASE_PORT), "allow traffic from container to database");

        // add fargate service to listener target group
        this.addFargateServiceToLoadBalancerTargetGroup();

        return this;
    }

    private createCluster(): ICluster {
        this.cluster = new Cluster(this.stack, `cluster`, {vpc: this.props.vpc, clusterName: `${STACK_NAME}-cluster` });
        return this.cluster;
    }

    private addFargateServiceToLoadBalancerTargetGroup() {
        /*
        * A target group tells a load balancer where to direct traffic to : EC2 instances, fixed IP addresses;
        * or AWS Lambda functions, amongst others.
        * When creating a load balancer, you create one or more listeners and configure listener rules to direct the traffic
        * to one target group.
        */

        // this health check should be configured properly. If not, target group wont be able to ping the app hoisted by container
        // the health check endpoint should point to the api-endpoint in the app.
        // If health check is not configured, the target group wont work and all the target groups will be unhealthy.
        const targetGroup = new ApplicationTargetGroup(this.stack, "target-group", {
            targetGroupName: `${STACK_NAME}-target-group`,
            port: 80,
            targets: [this.fargateService.loadBalancerTarget({
                containerName: CONTAINER.NAME,
                containerPort: CONTAINER.PORT
            })],
            healthCheck: {
                path: "/",
                interval: Duration.seconds(30)
            },
            vpc: this.props.vpc
        });

        // listener rule
        new CfnListenerRule(this.stack, "listener-rule", {
            actions: [
                {
                    type: "forward",
                    targetGroupArn: targetGroup.targetGroupArn
                }
            ],
            conditions: [
                {
                    field: "path-pattern",
                    pathPatternConfig: {
                        values: ['*']
                    }
                }
            ],
            listenerArn: this.props.listener.listenerArn,
            priority: 1
        });
    }

    private setupAutoScaling(): AppAutoScaling {
        return new AppAutoScaling(this.stack, {
            cluster: this.cluster,
            service: this.fargateService
        }).setupAutoScaling();
    }
}