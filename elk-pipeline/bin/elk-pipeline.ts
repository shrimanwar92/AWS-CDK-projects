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
    vpc: baseStack.vpc,
    logstashIP: openSearchLogStashInstanceStack.openSearchLogStashInstance.instancePublicIp,
    defaultEC2SecurityGroup: baseStack.defaultEC2SecurityGroup,
    defaultEC2Role: baseStack.defaultEC2Role,
    metricBeatRole: baseStack.metricBeatRole,
    ossSecurityGroupId: openSearchLogStashInstanceStack.openSearchSecurityGroup.securityGroupId
});

openSearchLogStashInstanceStack.addDependency(baseStack); // opensearch-logstash stack depends on base stack for vpc
appStack.addDependency(openSearchLogStashInstanceStack); // app stack depends on opensearch-logstash stack for its public ip