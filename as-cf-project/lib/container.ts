import {Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";
import {
    ContainerImage,
    FargateService,
    FargateTaskDefinition,
    LogDrivers,
    ICluster,
} from "@aws-cdk/aws-ecs";
import {
    CfnListenerRule,
    ApplicationTargetGroup, ListenerAction
} from '@aws-cdk/aws-elasticloadbalancingv2';
import {Role} from "@aws-cdk/aws-iam";
import {Duration, Stack} from "@aws-cdk/core";
import {STACK_NAME, CONTAINER} from "./utils";
import AppAutoScaling from "./autoscaling";
import ElasticSearch from "./elastic-search";
import {Domain} from "@aws-cdk/aws-elasticsearch";
import {ContainerStackProps} from "./container-stack";

export interface AppContainerProps extends ContainerStackProps {
    taskRole: Role,
    cluster: ICluster
}

export default class Container {
    readonly stack: Stack;
    readonly props: AppContainerProps;
    elasticSearch: Domain;

    constructor(stack: Stack, props: AppContainerProps) {
        this.stack = stack;
        this.props = props;
    }

    private createTaskDefinition(): FargateTaskDefinition {
        const taskDefinition = new FargateTaskDefinition(this.stack, 'app-task-def', {
            family: `${STACK_NAME}-app-task-def`,
            taskRole: this.props.taskRole,
            executionRole: this.props.taskRole
        });

        return taskDefinition;
    }

    addAppContainer() {
        const taskDefinition = this.createTaskDefinition();

        taskDefinition.addContainer(`container`, {
            image: ContainerImage.fromEcrRepository(this.props.repository),
            containerName: CONTAINER.NAME,
            logging: LogDrivers.awsLogs({ streamPrefix: `${STACK_NAME}-container-log` }),
            entryPoint: ["node", "server.js"],
            workingDirectory: "/app",
            secrets: {
                //ConnectionStrings__DefaultConnection: Secret.fromSsmParameter(props.parameter)
            },
            environment: {
                TEST: "my name is ... mkmmmkk", //+ this.elasticSearch.domainEndpoint,
                //ES_DOMAIN_ENDPOINT: this.elasticSearch.domainEndpoint
            },
            portMappings: [{containerPort: CONTAINER.PORT, hostPort: CONTAINER.PORT}]
        });
        const fargateService = this.startFargateService(taskDefinition);
        this.allowPermissions(fargateService);
        // add fargate service to listener target group
        this.addTargetGroupToListener(fargateService);
    }

    private startFargateService(taskDef: FargateTaskDefinition): FargateService {
        const fargateService = new FargateService(this.stack, `fargate-service`, {
            serviceName: `${STACK_NAME}-fargate-service`,
            cluster: this.props.cluster,
            taskDefinition: taskDef,
            desiredCount: 1,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE
            }
        });

        fargateService.node.addDependency(this.props.cluster);
        return fargateService;
    }

    private allowPermissions(service: FargateService) {
        // allow traffic from load balancer to container
        service.connections.allowFrom(this.props.loadBalancerSecurityGroup, Port.tcp(CONTAINER.PORT), "allow traffic from Lb security group to container port");

        // allow container to pull ECR image
        const defaultFargateSecurityGroup = service.connections.securityGroups[0];
        const fargateSecurityGroup = SecurityGroup.fromSecurityGroupId(this.stack, 'import-fargate-sg', defaultFargateSecurityGroup.securityGroupId);
        fargateSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "allow container to pull ecr image");

        // allow traffic from container to database
        //this.props.databaseSecurityGroup.connections.allowFrom(fargateSecurityGroup, Port.tcp(DATABASE_PORT), "allow traffic from container to database");
    }

    private addTargetGroupToListener(service: FargateService) {
        /*
        * A target group tells a load balancer where to direct traffic to : EC2 instances, fixed IP addresses;
        * or AWS Lambda functions, amongst others.
        * When creating a load balancer, you create one or more listeners and configure listener rules to direct the traffic
        * to one target group.
        */

        // this health check should be configured properly. If not, target group wont be able to ping the app hoisted by container
        // the health check endpoint should point to the api-endpoint in the app.
        // If health check is not configured, the target group wont work and all the target groups will be unhealthy.
        const appTargetGroup = new ApplicationTargetGroup(this.stack, "app-target-group", {
            targetGroupName: `${STACK_NAME}-app-tg`,
            port: 80,
            targets: [service.loadBalancerTarget({
                containerName: CONTAINER.NAME,
                containerPort: CONTAINER.PORT
            })],
            healthCheck: {
                path: "/hc",
                interval: Duration.seconds(30)
            },
            vpc: this.props.vpc
        });

        const appListener = this.props.loadBalancer.addListener('AppListener', {
            port: 80,
            open: true,
        });
        appListener.addAction("listener-action", {
            action: ListenerAction.fixedResponse(200, {
                contentType: "text/plain",
                messageBody: "xxx 12345 xxx"
            })
        });

        appListener.node.addDependency(this.props.loadBalancer);

        // listener rule
        new CfnListenerRule(this.stack, "listener-rule", {
            actions: [
                {
                    type: "forward",
                    targetGroupArn: appTargetGroup.targetGroupArn
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
            listenerArn: appListener.listenerArn,
            priority: 1
        });
    }

    /*addElasticSearch() {
        this.elasticSearch = new ElasticSearch(this.stack, {
            cluster: this.props.cluster,
            vpc: this.props.vpc
        }).createElasticSearchDomain();
        this.elasticSearch.grantReadWrite(this.taskDefinition.taskRole);
        return this;
    }*/
}