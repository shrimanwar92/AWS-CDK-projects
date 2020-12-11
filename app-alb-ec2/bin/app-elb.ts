#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { InfraStack } from '../lib/app-elb-stack';

const app = new cdk.App();
new InfraStack(app, 'Infra');
