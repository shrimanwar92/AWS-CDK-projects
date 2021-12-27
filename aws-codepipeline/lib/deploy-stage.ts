import {EcsDeployAction} from "aws-cdk-lib/aws-codepipeline-actions";
import {Stack, StackProps} from 'aws-cdk-lib';
import {Artifact, StageOptions} from "aws-cdk-lib/aws-codepipeline";
import ECSFargate from "./ecs";
import {IRepository} from "aws-cdk-lib/aws-ecr";

interface DeployStageProps extends StackProps {
    ecrRepository: IRepository
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
            service: new ECSFargate(this.stack).create(this.props.ecrRepository),
        });

        return {
            stageName: 'DeployToProduction',
            actions: [action]
        };
    }
}