import {RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Artifact, Pipeline} from "aws-cdk-lib/aws-codepipeline";
import {STACK_NAME, REPO_NAME} from "./utils";
import SourceStage from "./source-stage";
import {Repository} from "aws-cdk-lib/aws-ecr";
import BuildStage from "./build-stage";
import DeployStage, {DeployStageProps} from "./deploy-stage";
import {Vpc} from "aws-cdk-lib/aws-ec2";
import ECSFargate from "./ecs";
import {ApplicationLoadBalancedFargateService} from "aws-cdk-lib/aws-ecs-patterns";
import {Bucket} from "aws-cdk-lib/aws-s3";

export class BaseStack extends Stack {
    ecrRepository: Repository;
    githubToken: string;
    applicationLoadBalancedFargateService: ApplicationLoadBalancedFargateService;
    vpc: Vpc;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Usage: npx cdk synth AwsCodepipelineStack --context githubToken=123abc
        this.githubToken = this.node.tryGetContext("githubToken");
        if(!this.githubToken) {
            throw new Error("Github oauth token is required.");
        }
        this.ecrRepository = Repository.fromRepositoryName(this, `${STACK_NAME}-repo-1`, REPO_NAME) as unknown as Repository;
        this.vpc = new Vpc(this, `${STACK_NAME}-vpc`, { natGateways: 1 });
        this.applicationLoadBalancedFargateService = new ECSFargate(this, {
            vpc: this.vpc,
            ecrRepository: this.ecrRepository
        }).create();
    }
}

export class AwsCodepipelineStack extends Stack {
    constructor(scope: Construct, id: string, props: DeployStageProps & StackProps) {
        super(scope, id, props);

        const sourceOutput = new Artifact();
        const buildOutput = new Artifact();

        const pipeline = new Pipeline(this, `${STACK_NAME}-pipeline`, {
            pipelineName: `${STACK_NAME}-pipeline`
        });

        // source stage
        const sourceStage = new SourceStage(this, {githubToken: props.githubToken}).create(sourceOutput);
        pipeline.addStage(sourceStage);

        // build stage
        const buildStage = new BuildStage(this, {ecrRepository: props.ecrRepository}).create(sourceOutput, buildOutput);
        pipeline.addStage(buildStage);

        // deploy stage
        const deployStage = new DeployStage(this, {
            ecrRepository: props.ecrRepository,
            vpc: props.vpc,
            githubToken: props.githubToken,
            albfs: props.albfs
        }).create(buildOutput);

        pipeline.addStage(deployStage);
    }
}
