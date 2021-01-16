import * as cdk from '@aws-cdk/core';
import {VPC} from "./vpc";
import {ALB} from "./alb";
import {AutoScaling} from "./auto-scaling";
import {STACK_NAME} from "./utils";
import {ListenerCondition} from "@aws-cdk/aws-elasticloadbalancingv2";
import {EC2} from "./ec2";
import {IInstance, Instance} from "@aws-cdk/aws-ec2";

export class AppScalingStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here
        const vpc = new VPC(this).vpc;

        const alb = new ALB(this, {
            vpc: vpc
        }).createLoadBalancer();

        const instance = new EC2(this, {
            vpc: vpc
        }).createInstance();

        const asg = new AutoScaling(this, {
            vpc: vpc,
            albSecurityGroup: alb.albSecurityGroup,
            targetGroup: alb.targetGroup,
            instance: instance
        }).createAutoScaling();
    }
}
