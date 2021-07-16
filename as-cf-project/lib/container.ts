import {IRepository} from "@aws-cdk/aws-ecr";
import {ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";
import {
    Cluster,
    ContainerImage,
    FargateService,
    FargateTaskDefinition,
    LogDrivers,
    ContainerDefinition,
    Secret,
} from "@aws-cdk/aws-ecs";
import {
    IApplicationListener,
    CfnListenerRule,
    ApplicationTargetGroup
} from '@aws-cdk/aws-elasticloadbalancingv2';
import {Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {StringParameter} from "@aws-cdk/aws-ssm";
//import {DatabaseStackProps, OdataStack} from './odata-stack';
import {Duration, Stack} from "@aws-cdk/core";
import {STACK_NAME, CONTAINER_PORT, CONTAINER_NAME} from "./utils";

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

    constructor(stack: Stack, props: ContainerProps) {
        this.stack = stack;
        this.props = props;
    }

    createFromRepository() {
        // create task role
        // create task definition
        // create container
        // create fargateService
        return this.createTaskRole()
            .createTaskDefinition()
            .addContainer()
            .startFargateService();
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
        this.taskDefinition.node.addDependency(this.taskRole);

        return this;
    }

    private addContainer() {
        this.container = this.taskDefinition.addContainer(`container`, {
            image: ContainerImage.fromEcrRepository(this.props.repository),
            containerName: CONTAINER_NAME,
            logging: LogDrivers.awsLogs({ streamPrefix: `${STACK_NAME}-log` }),
            entryPoint: ["dotnet", "Nimbus.OData.Server.dll"],
            workingDirectory: "/app",
            secrets: {
                //ConnectionStrings__DefaultConnection: Secret.fromSsmParameter(props.parameter)
            }
        });
        this.container.addPortMappings({containerPort: CONTAINER_PORT, hostPort: CONTAINER_PORT});
        this.container.node.addDependency(this.taskDefinition);
        this.container.node.addDependency(this.props.repository);
        return this;
    }

    private startFargateService() {
        this.fargateService = new FargateService(this.stack, `fargate-service`, {
            serviceName: `${STACK_NAME}-fargate-service`,
            cluster: new Cluster(this.stack, `cluster`, {vpc: this.props.vpc, clusterName: `${STACK_NAME}-cluster` }),
            taskDefinition: this.taskDefinition,
            desiredCount: 1,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE
            }
        });

        this.fargateService.node.addDependency(this.taskDefinition);

        // allow traffic from load balancer to container
        this.fargateService.connections.allowFrom(this.props.loadBalancerSecurityGroup, Port.tcp(3000), "allow traffic from Lb security group to container port");

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

    private addFargateServiceToLoadBalancerTargetGroup() {
        /*
        * A target group tells a load balancer where to direct traffic to : EC2 instances, fixed IP addresses;
        * or AWS Lambda functions, amongst others.
        * When creating a load balancer, you create one or more listeners and configure listener rules to direct the traffic
        * to one target group.
        */
        const targetGroup = new ApplicationTargetGroup(this.stack, "target-group", {
            targetGroupName: `${STACK_NAME}-target-group`,
            port: 80,
            targets: [this.fargateService.loadBalancerTarget({
                containerName: CONTAINER_NAME,
                containerPort: CONTAINER_PORT
            })],
            healthCheck: {
                path: "/hc",
                interval: Duration.seconds(30)
            },
            vpc: this.props.vpc
        });

        /*this.props.listener.addTargetGroups("listener-tg", {
            priority: 1,
            targetGroups: [targetGroup],
            conditions: [
                ListenerCondition.pathPatterns(['*'])
            ]
        });*/

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
}