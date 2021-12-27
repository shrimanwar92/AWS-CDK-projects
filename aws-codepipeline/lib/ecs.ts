import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {Cluster, ContainerImage, FargateService} from "aws-cdk-lib/aws-ecs";
import {Stack} from "aws-cdk-lib";
import {STACK_NAME, PipelineContainerImage} from "./utils";
import {IRepository} from "aws-cdk-lib/aws-ecr";
import {ManagedPolicy} from "aws-cdk-lib/aws-iam";

export default class ECSFargate {
    readonly stack: Stack;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    create(repository: IRepository): FargateService {
        const cluster = new Cluster(this.stack, `${STACK_NAME}-ecs-cluster`);
        const fargateService = new ApplicationLoadBalancedFargateService(this.stack, `${STACK_NAME}-fargate-service`, {
            cluster: cluster,
            memoryLimitMiB: 1024,
            assignPublicIp: false,
            desiredCount: 1,
            cpu: 512,
            taskImageOptions: {
                //image: new PipelineContainerImage(repository),
                image: ContainerImage.fromEcrRepository(repository),
                containerName: 'web',
                containerPort: 3000
            },
        });

        fargateService.taskDefinition.executionRole?.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser')
        );
        repository.grantPull(fargateService.taskDefinition.executionRole!);

        return fargateService.service;
    }
}