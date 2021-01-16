#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from '@aws-cdk/core';
import { AppScalingStack } from '../lib/app-scaling-stack';

const app = new cdk.App();
new AppScalingStack(app, 'AppScalingStack');
