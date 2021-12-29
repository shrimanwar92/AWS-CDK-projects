import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {Cluster, ContainerImage, DeploymentControllerType, FargateTaskDefinition} from "aws-cdk-lib/aws-ecs";
import {Stack} from "aws-cdk-lib";
import {REPO_NAME, STACK_NAME} from "./utils";
import {IRepository} from "aws-cdk-lib/aws-ecr";
import {Effect, ManagedPolicy, PolicyStatement} from "aws-cdk-lib/aws-iam";
import {IVpc} from "aws-cdk-lib/aws-ec2";

type EcsProps = {
    vpc: IVpc,
    ecrRepository: IRepository
}

export default class ECSFargate {
    readonly stack: Stack;
    readonly props: EcsProps;

    constructor(stack: Stack, props: EcsProps) {
        this.stack = stack;
        this.props = props;
    }

    create(): ApplicationLoadBalancedFargateService {
        const cluster = new Cluster(this.stack, `${STACK_NAME}-ecs-cluster`, {
            clusterName: `${STACK_NAME}-ecs-cluster`,
            vpc: this.props.vpc
        });
        const applicationLoadBalancedFargateService = new ApplicationLoadBalancedFargateService(this.stack, `${STACK_NAME}-fargate-service`, {
            cluster: cluster,
            serviceName: `${STACK_NAME}-fargate-service`,
            memoryLimitMiB: 1024,
            cpu: 512,
            assignPublicIp: false,
            desiredCount: 1,
            taskDefinition: this.createTaskDefinition(),
            deploymentController: {
                type: DeploymentControllerType.ECS
            }
        });

        return applicationLoadBalancedFargateService;
    }

    private createTaskDefinition() {
        const executionRolePolicy = new PolicyStatement({
            effect: Effect.ALLOW,
            resources: ['*'],
            actions: [
                'ecr:GetAuthorizationToken',
                'ecr:BatchCheckLayerAvailability',
                'ecr:GetDownloadUrlForLayer',
                'ecr:BatchGetImage',
                'logs:CreateLogStream',
                'logs:PutLogEvents',
            ],
        });
        const taskDef = new FargateTaskDefinition(this.stack, `${STACK_NAME}-task-def`);
        taskDef.addToExecutionRolePolicy(executionRolePolicy);
        taskDef.addContainer('app-container', {
            image: ContainerImage.fromEcrRepository(this.props.ecrRepository),
            portMappings: [{ containerPort: 3000 }],
            containerName: REPO_NAME
        });

        taskDef.executionRole?.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser')
        );
        this.props.ecrRepository.grantPull(taskDef.executionRole!);

        return taskDef;
    }
}