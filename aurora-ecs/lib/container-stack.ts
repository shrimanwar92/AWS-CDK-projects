import {IRepository} from "@aws-cdk/aws-ecr";
import {IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";
import {Cluster, ContainerImage, FargateService, FargateTaskDefinition, LogDrivers, Secret} from "@aws-cdk/aws-ecs";
import {IApplicationListener, ListenerCondition, ApplicationTargetGroup} from '@aws-cdk/aws-elasticloadbalancingv2';
import {Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {StringParameter} from "@aws-cdk/aws-ssm";
import {DatabaseStackProps, OdataStack} from './odata-stack';
import {Duration} from "@aws-cdk/core";
import {CONTAINER_PORT, DATABASE_PORT} from "./utils";

type FargateServiceProps = {
    instance: OdataStack,
    repository: IRepository,
    vpc: IVpc,
    parameter: StringParameter
}

export class ContainerStack {
    props: DatabaseStackProps;
    instance: OdataStack;
    taskRole: Role;
    private STACK_NAME: string | undefined;

    constructor(instance: OdataStack, props: DatabaseStackProps) {
        this.instance = instance;
        this.props = props;
        this.STACK_NAME = props.stackName;
        this.taskRole =  new Role(instance, `odata-task-role`, {
            roleName: `${this.STACK_NAME}-task-role`,
            assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
        });
        this.props.repository.grantPull(this.taskRole);
    }

    public createContainer(parameter: StringParameter) {
        const fargateService = this.createFargateService({
            instance: this.instance,
            repository: this.props.repository,
            vpc: this.props.vpc,
            parameter
        });

        // wait for parameter store to be deployed
        fargateService.node.addDependency(parameter);

        // Set up security group ingress/egress between LB and new service
        fargateService.connections.allowFrom(this.props.elb.loadBalancerSecurityGroup, Port.tcp(CONTAINER_PORT), "allow traffic from Lb security group to container port");

        this.setListenerTarget(this.props.elb.listener, fargateService);

        // allow traffic from container to database
        const createdSg = fargateService.connections.securityGroups[0];
        const fargateSecurityGroup = SecurityGroup.fromSecurityGroupId(this.instance, `odata-import-fargate-sg`, createdSg.securityGroupId);
        this.props.databaseSecurityGroup.connections.allowFrom(fargateSecurityGroup, Port.tcp(DATABASE_PORT), "allow traffic from container to database");
        fargateSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "allow container to pull ecr image");
    }

    private setListenerTarget(listener: IApplicationListener, service: FargateService): void {
        const targetGroup = new ApplicationTargetGroup(this.instance, "odata-tg", {
            targetGroupName: `${this.STACK_NAME}-tg`,
            port: 80,
            targets: [service.loadBalancerTarget({
                containerName: `odata-container`,
                containerPort: CONTAINER_PORT
            })],
            healthCheck: {
                path: "/hc",
                interval: Duration.seconds(30)
            },
            vpc: this.props.vpc
        });

        listener.addTargetGroups("odata-listener-tg", {
            priority: 1,
            targetGroups: [targetGroup],
            conditions: [
                ListenerCondition.pathPatterns(['/odata*'])
            ]
        });
    }

    private createFargateService(props: FargateServiceProps): FargateService {
        // create our task definition, container, and add port mappings
        const taskDefinition = new FargateTaskDefinition(props.instance, `odata-task-definition`, {
            family: `${this.STACK_NAME}-task-definition-family`,
            taskRole: this.taskRole,
            executionRole: this.taskRole
        });

        const container = taskDefinition.addContainer(`odata-container`, {
            image: ContainerImage.fromEcrRepository(props.repository),
            logging: LogDrivers.awsLogs({ streamPrefix: `${this.STACK_NAME}-log` }),
            entryPoint: ["dotnet", "Nimbus.OData.Server.dll"],
            workingDirectory: "/app",
            secrets: {
                ConnectionStrings__DefaultConnection: Secret.fromSsmParameter(props.parameter)
            }
        });
        container.addPortMappings({containerPort: CONTAINER_PORT, hostPort: CONTAINER_PORT});

        const service = new FargateService(props.instance, `odata-fargate-service`, {
            serviceName: `${this.STACK_NAME}-fargate-service`,
            cluster: new Cluster(props.instance, `odata-cluster`, {vpc: props.vpc, clusterName: `${this.STACK_NAME}-cluster` }),
            taskDefinition,
            desiredCount: 1,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE
            }
        });

        return service;
    }
}