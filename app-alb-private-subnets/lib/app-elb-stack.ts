import * as cdk from '@aws-cdk/core';
import {Port, IVpc, CfnVPC, Vpc} from "@aws-cdk/aws-ec2";
import {ApplicationTargetGroup, ListenerCondition} from "@aws-cdk/aws-elasticloadbalancingv2";
import {InstanceTarget} from "@aws-cdk/aws-elasticloadbalancingv2-targets";
import {EC2, CustomInstance} from "./ec2"
import {ALB, CustomApplicationLoadBalancer} from "./load-balancer";
import {STACK_NAME, AVAILABILITY_ZONES} from "./utils";
import VPC from "./vpc";
import {Aws, Fn} from "@aws-cdk/core";

export class InfraStack extends cdk.Stack {
    vpc: IVpc;
    lb: CustomApplicationLoadBalancer;
    ec2: CustomInstance;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // create vpc
        this.createVpc();

        // create loadbalancer
        this.createLoadBalancer();

        // create ec2 instance
        this.createEC2Instance();

        // create target group
        this.setListenerTarget();
    }

    private setListenerTarget() {
        // create a target group with health check
        // add the EC2 instance as a target
        const targetGroup = new ApplicationTargetGroup(this, `${STACK_NAME}-tg`, {
            targetGroupName: `${STACK_NAME}-tg`,
            port: 80,
            targets: [new InstanceTarget(this.ec2.instance, 80)],
            healthCheck: {
                path: "/",
                interval: cdk.Duration.seconds(30)
            },
            vpc: this.vpc
        });

        // configure the target in the listener
        this.lb.listener.addTargetGroups(`${STACK_NAME}-tg12`, {
            priority: 1,
            targetGroups: [targetGroup],
            conditions: [
                ListenerCondition.pathPatterns(['/'])
            ]
        });
    }

    private createEC2Instance() {
        this.ec2 = new EC2(this, {
            vpc: this.vpc
        }).createInstance();
        this.ec2.instance.node.addDependency(this.lb.loadBalancerSecurityGroup);
        this.ec2.instanceSecurityGroup.connections.allowFrom(this.lb.loadBalancerSecurityGroup, Port.tcp(80), "allow conn from lb-security-grp to instance-security-grp");
    }

    private createVpc() {
        const vpc = new VPC(this);

        this.vpc = Vpc.fromVpcAttributes(this, "vpcxyz", {
            vpcId: vpc.vpc.ref,
            availabilityZones: AVAILABILITY_ZONES,
            privateSubnetIds: vpc.subnets.private.map(s => s.ref),
            publicSubnetIds: vpc.subnets.public.map(s => s.ref)
        });
    }

    private createLoadBalancer() {
        this.lb = new ALB(this, {
            vpc: this.vpc
        }).create();
    }
}
