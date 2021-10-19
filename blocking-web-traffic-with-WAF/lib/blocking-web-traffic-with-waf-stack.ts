import {Stack, StackProps, Construct} from '@aws-cdk/core';
import MyVPC from "./vpc";
import AppLoadBalancer from "./elbv2";
import Ec2Instance from "./instances";
import {CfnListener, CfnTargetGroup} from "@aws-cdk/aws-elasticloadbalancingv2";
import {STACK_NAME} from "./utils";
import MyWAF from "./waf";

export class BlockingWebTrafficWithWafStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const {vpc} = new MyVPC(this);
        const {loadBalancer, loadBalancerSG} = new AppLoadBalancer(this, {vpc: vpc});
        const ec2Instances = new Ec2Instance(this, {
            vpc: vpc, loadBalancerSG: loadBalancerSG, noOfInstances: 1
        }).create();

        const targetGroup = new CfnTargetGroup(this, `${STACK_NAME}-tg`, {
            name: `${STACK_NAME}-tg`,
            port: 80,
            protocol: 'HTTP',
            targetType: 'instance',
            targets: ec2Instances.map(instance => {
                return {
                    id: instance.ref,
                    port: 80
                }
            }),
            healthCheckEnabled: true,
            healthCheckPath: "/",
            healthCheckIntervalSeconds: 30,
            vpcId: vpc.vpcId
        });

        new CfnListener(this, 'AlbListener', {
            defaultActions: [{
                type: 'forward',
                forwardConfig: {
                    targetGroups: [{
                        targetGroupArn: targetGroup.ref,
                        weight: 1
                    }]
                }
            }],
            loadBalancerArn: loadBalancer.loadBalancerArn,
            port: 80,
            protocol: 'HTTP'
        });

        const waf = new MyWAF(this, {loadBalancer});
        waf.setSQLInjectionRule();
        waf.setQueryStringRule();
        waf.createWebAcl();
    }
}
