import {RemovalPolicy, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import {Artifact, Pipeline} from "aws-cdk-lib/aws-codepipeline";
import {STACK_NAME, REPO_NAME} from "./utils";
import SourceStage from "./source-stage";
import {Repository} from "aws-cdk-lib/aws-ecr";
import BuildStage from "./build-stage";
import DeployStage from "./deploy-stage";

export class AwsCodepipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // Usage: npx cdk synth AwsCodepipelineStack --context githubToken=123abc --context step=build
        const githubToken = this.node.tryGetContext("githubToken");
        const step = this.node.tryGetContext("step");

        if(!githubToken) {
            throw new Error("Github oauth token is required.");
        }

        const sourceOutput = new Artifact();
        const buildOutput = new Artifact();

        const ecrRepository = new Repository(this, `${STACK_NAME}-ecr-repo`, {
            repositoryName: REPO_NAME,
            removalPolicy: RemovalPolicy.DESTROY
        });

        const pipeline = new Pipeline(this, `${STACK_NAME}-pipeline`);

        if(step === 'build') {
            // source stage
            const sourceStage = new SourceStage(this, {githubToken}).create(sourceOutput);
            pipeline.addStage(sourceStage);
            // build stage
            const buildStage = new BuildStage(this, {ecrRepository}).create(sourceOutput, buildOutput);
            pipeline.addStage(buildStage);
        } else if(step === 'deploy') {
            // source stage
            const sourceStage = new SourceStage(this, {githubToken}).create(sourceOutput);
            pipeline.addStage(sourceStage);
            // build stage
            const buildStage = new BuildStage(this, {ecrRepository}).create(sourceOutput, buildOutput);
            pipeline.addStage(buildStage);
            // deploy stage
            const deployStage = new DeployStage(this, {ecrRepository}).create(buildOutput);
            pipeline.addStage(deployStage);
        }
    }
}
