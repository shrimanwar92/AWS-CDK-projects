import {IRepository} from "@aws-cdk/aws-ecr";
import {IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";
import {
    Cluster,
    ContainerImage,
    FargateService,
    FargateTaskDefinition,
    LogDrivers,
    ContainerDefinition,
    Secret, IFargateService
} from "@aws-cdk/aws-ecs";
import {IApplicationListener, ListenerCondition, ApplicationTargetGroup} from '@aws-cdk/aws-elasticloadbalancingv2';
import {Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {StringParameter} from "@aws-cdk/aws-ssm";
//import {DatabaseStackProps, OdataStack} from './odata-stack';
import {Duration, Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";

interface ContainerProps {
    vpc: IVpc,
    repository: IRepository
}

export default class Container {
    readonly stack: Stack;
    readonly props: ContainerProps;
    taskDefinition: FargateTaskDefinition;
    taskRole: Role;
    container: ContainerDefinition;
    fargateService: IFargateService;

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
        //this.props.repository.grantPull(this.taskRole);

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
            logging: LogDrivers.awsLogs({ streamPrefix: `${STACK_NAME}-log` }),
            entryPoint: ["dotnet", "Nimbus.OData.Server.dll"],
            workingDirectory: "/app",
            secrets: {
                //ConnectionStrings__DefaultConnection: Secret.fromSsmParameter(props.parameter)
            }
        });
        this.container.addPortMappings({containerPort: 3000, hostPort: 3000});
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

        return this;
    }
}