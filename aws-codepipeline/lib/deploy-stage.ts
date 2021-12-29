import {EcsDeployAction} from "aws-cdk-lib/aws-codepipeline-actions";
import {Stack} from 'aws-cdk-lib';
import {Artifact, StageOptions} from "aws-cdk-lib/aws-codepipeline";
import {Repository} from "aws-cdk-lib/aws-ecr";
import {Vpc} from "aws-cdk-lib/aws-ec2";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";

export interface DeployStageProps {
    githubToken: string,
    ecrRepository: Repository,
    vpc: Vpc,
    albfs: ApplicationLoadBalancedFargateService
}

export interface EcsDeploymentGroupProps {
    applicationName: string
    deploymentGroupName: string
    deploymentConfigName: string
    serviceRoleArn: string
    blueTargetGroup: string
    greenTargetGroup: string
    prodListenerArn: string
    testListenerArn: string
    ecsClusterName: string
    ecsServiceName: string
    terminationWaitTimeInMinutes: number
}

export default class DeployStage {
    private readonly stack: Stack;
    private readonly props: DeployStageProps;

    constructor(stack: Stack, props: DeployStageProps) {
        this.stack = stack;
        this.props = props;
    }

    create(input: Artifact): StageOptions {
        const action = new EcsDeployAction({
            actionName: 'ProductionEcsDeployAction',
            input: input,
            service: this.props.albfs.service,
        });

        return {
            stageName: 'DeployToProduction',
            actions: [action]
        };
    }

    /*createCodeDeployAction(input: Artifact): StageOptions {
        const albfs = this.props.albfs;

        const greenTG = new ApplicationTargetGroup(this.stack, `${STACK_NAME}-green-tg`, {
            targetGroupName: `${STACK_NAME}-green-tg`,
            port: 80,
            targetType: TargetType.IP,
            vpc: this.props.vpc,
        });

        const greenListner = new ApplicationListener(this.stack, `${STACK_NAME}-green-listener`, {
            loadBalancer: albfs.loadBalancer,
            port: 8100,
            open: true,
            protocol: ApplicationProtocol.HTTP,
            defaultAction: ListenerAction.forward([greenTG]),
        });
        greenTG.registerListener(greenListner);

        const ecsApplication = new EcsApplication(this.stack, `${STACK_NAME}-ecs-app`, {
            applicationName: `${STACK_NAME}-ecs-app`
        });

        const codeDeployServiceRole = new Role(this.stack, `${STACK_NAME}-code-deploy-role`, {
            roleName: `${STACK_NAME}-code-deploy-role`,
            assumedBy: new ServicePrincipal("codedeploy.amazonaws.com"),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName("AWSCodeDeployRoleForECS")
            ]
        });

        const deploymentGroupProperties: EcsDeploymentGroupProps =  {
            applicationName: ecsApplication.applicationName,
            deploymentGroupName: DEPLOYMENT_GRP_NAME,
            deploymentConfigName: 'CodeDeployDefault.ECSAllAtOnce',
            serviceRoleArn: codeDeployServiceRole.roleArn,
            blueTargetGroup: albfs.targetGroup.targetGroupName,
            greenTargetGroup: greenTG.targetGroupName,
            prodListenerArn: albfs.listener.listenerArn,
            testListenerArn: greenListner.listenerArn,
            ecsClusterName: albfs.service.cluster.clusterName,
            ecsServiceName: albfs.service.serviceName,
            terminationWaitTimeInMinutes: 10,
        };
        new CustomResource(this.stack).createCodeDeployDeploymentGroup(deploymentGroupProperties)

        const action =  new CodeDeployEcsDeployAction({
            actionName: `${STACK_NAME}-code-deploy-action`,
            deploymentGroup: EcsDeploymentGroup.fromEcsDeploymentGroupAttributes(this.stack, 'DeploymentGroup', {
                application: ecsApplication,
                deploymentGroupName: DEPLOYMENT_GRP_NAME,
                deploymentConfig: EcsDeploymentConfig.ALL_AT_ONCE,
            }),
            taskDefinitionTemplateInput: input,
            appSpecTemplateInput: input,
            containerImageInputs: [{
                input: input,
                taskDefinitionPlaceholder: "IMAGE1_NAME"
            }]
        });

        return {
            stageName: 'DeployToProduction',
            actions: [action]
        };
    }*/
}