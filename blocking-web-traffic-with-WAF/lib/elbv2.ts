import {
    ApplicationLoadBalancer, IApplicationListener,
    IApplicationLoadBalancer
} from "@aws-cdk/aws-elasticloadbalancingv2";
import {CfnOutput, Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";

interface LoadBalancerProps {
    vpc: IVpc
}

export default class AppLoadBalancer {
    loadBalancer: IApplicationLoadBalancer;
    loadBalancerSG: ISecurityGroup;

    constructor(stack: Stack, props: LoadBalancerProps) {
        this.loadBalancerSG = new SecurityGroup(stack, `${STACK_NAME}-alb-sg`, {
            securityGroupName: `${STACK_NAME}-alb-sg`,
            description: "security group for load balancer",
            vpc: props.vpc,
            allowAllOutbound: true
        });
        this.loadBalancerSG.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow traffic on port 80");

        this.loadBalancer = new ApplicationLoadBalancer(stack, `${STACK_NAME}-lb`, {
            loadBalancerName: `${STACK_NAME}-lb`,
            vpc: props.vpc,
            internetFacing: true,
            securityGroup: this.loadBalancerSG,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC
            }
        });
        // wait for vpc and security group to be created first
        this.loadBalancer.node.addDependency(props.vpc);
        this.loadBalancer.node.addDependency(this.loadBalancerSG);

        new CfnOutput(stack, 'LoadBalancer DNS', {
            value: this.loadBalancer.loadBalancerDnsName,
            description: 'load balancer DNS'
        });
    }
}