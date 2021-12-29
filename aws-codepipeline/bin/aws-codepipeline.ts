#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { AwsCodepipelineStack, BaseStack } from '../lib/aws-codepipeline-stack';

const app = new cdk.App();

const base = new BaseStack(app, 'BaseStack');

new AwsCodepipelineStack(app, 'AwsCodepipelineStack', {
    vpc: base.vpc,
    albfs: base.applicationLoadBalancedFargateService,
    ecrRepository: base.ecrRepository,
    githubToken: base.githubToken
});