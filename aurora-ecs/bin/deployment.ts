#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import * as Stack from '../lib';
import {DEFAULT_REPOSITORY_NAME} from '../lib/utils';

const app = new cdk.App();
const envMode = process.env.mode || 'dev'; // get env mode
let options = <Stack.InfrastructureStackProps>{};
let dev: Stack.DevStack;

dev = new Stack.DevStack(app, 'DevStack', {
    stackName: envMode
});

if(!envMode.toLowerCase().includes('prod')) {
    // if the env mode is dev, qa, staging
    options = {
        vpcId: dev.vpc.vpcId,
        azs: dev.availabilityZones.toString(),
        loadbalancerArn: dev.loadbalancer.loadBalancerArn,
        securityGroupId: dev.securityGroup.securityGroupId,
        privateSubnetIds: dev.vpc.privateSubnets.map(subnet => subnet.subnetId).toString(),
        repositoryName: DEFAULT_REPOSITORY_NAME,
        stackName: `odata-${envMode}`,
        listenerArn: dev.listener.listenerArn
    };
}

new Stack.RepositoryStack(app, 'Repository');
new Stack.OdataStack(app,'OData', {
    ...options
});
