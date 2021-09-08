import {
    ApplicationLoadBalancer, IApplicationListener,
    IApplicationLoadBalancer
} from "@aws-cdk/aws-elasticloadbalancingv2";
import {CfnOutput, Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {ISecurityGroup, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";
import {VPCProps} from "./vpc";

type LoadBalancerProps = VPCProps;

export default class ElasticLoadBalancer {
    readonly stack: Stack;
    readonly props: LoadBalancerProps;
    loadBalancer: IApplicationLoadBalancer;
    loadBalancerSecurityGroup: ISecurityGroup;

    constructor(stack: Stack, props: LoadBalancerProps) {
        this.stack = stack;
        this.props = props;
    }

    create(): ElasticLoadBalancer {
        this.loadBalancerSecurityGroup = new SecurityGroup(this.stack, `${STACK_NAME}-alb-sg`, {
            securityGroupName: `${STACK_NAME}-alb-sg`,
            description: "security group for load balancer",
            vpc: this.props.vpc,
            allowAllOutbound: true
        });
        this.loadBalancerSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow traffic on port 80");
        this.loadBalancerSecurityGroup.addIngressRule(Peer.ipv4("106.215.63.120/32"), Port.tcp(8080), "allow traffic on port 8080 for jenkins");

        this.loadBalancer = new ApplicationLoadBalancer(this.stack, `${STACK_NAME}-lb`, {
            loadBalancerName: `${STACK_NAME}-lb`,
            vpc: this.props.vpc,
            internetFacing: true,
            securityGroup: this.loadBalancerSecurityGroup,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC
            }
        });
        // wait for vpc and security group to be created first
        this.loadBalancer.node.addDependency(this.props.vpc);
        this.loadBalancer.node.addDependency(this.loadBalancerSecurityGroup);

        // sometimes gateway attachment takes some time to be created. So when CF creates load balancer, if it do not find the gateway
        // so it throws error "VPC vpc-01bc156233b79a0b6 has no internet gateway (Service: AmazonElasticLoadBalancingV2; Status Code: 400; Error Code: InvalidSubnet;"
        // https://github.com/awslabs/aws-cloudformation-templates/commit/6e3af420c3a872adf3b89db3a5a36ac994d676ff
        this.loadBalancer.node.addDependency(this.props.gatewayAttachment);
        new CfnOutput(this.stack, 'LoadBalancer DNS', {
            value: this.loadBalancer.loadBalancerDnsName,
            description: 'load balancer DNS'
        });

        return this;
    }
}