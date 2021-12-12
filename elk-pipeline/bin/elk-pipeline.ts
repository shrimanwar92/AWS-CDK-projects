#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { BaseStack, OpenSearchLogStash, AppStack } from '../lib/elk-pipeline-stack';

const app = new cdk.App();

const baseStack = new BaseStack(app, 'BaseStack');

const openSearchLogStashInstanceStack = new OpenSearchLogStash(app, 'OpenSearchLogStash', {
    vpc: baseStack.vpc,
    defaultEC2Role: baseStack.defaultEC2Role
});

const appStack = new AppStack(app, 'AppStack', {
    /* If you don't specify 'env', this stack will be environment-agnostic.
    * Account/Region-dependent features and context lookups will not work,
    * but a single synthesized template can be deployed anywhere. */

    /* Uncomment the next line to specialize this stack for the AWS Account
    * and Region that are implied by the current CLI configuration. */
    // env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: process.env.CDK_DEFAULT_REGION },

    /* Uncomment the next line if you know exactly what Account and Region you
    * want to deploy the stack to. */
    // env: { account: '123456789012', region: 'us-east-1' },

    /* For more information, see https://docs.aws.amazon.com/cdk/latest/guide/environments.html */
    vpc: baseStack.vpc,
    logstashIP: openSearchLogStashInstanceStack.openSearchLogStashInstance.instancePublicIp,
    defaultEC2SecurityGroup: baseStack.defaultEC2SecurityGroup,
    defaultEC2Role: baseStack.defaultEC2Role,
    metricBeatRole: baseStack.metricBeatRole
});

openSearchLogStashInstanceStack.addDependency(baseStack); // opensearch-logstash stack depends on base stack for vpc
appStack.addDependency(openSearchLogStashInstanceStack); // app stack depends on opensearch-logstash stack for its public ip