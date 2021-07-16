import {
    ApplicationListener,
    ApplicationLoadBalancer,
    IApplicationLoadBalancer,
    ListenerAction
} from "@aws-cdk/aws-elasticloadbalancingv2";
import {Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";

interface LoadBalancerProps {
    vpc: IVpc
}

export default class ElasticLoadBalancer {
    readonly stack: Stack;
    readonly props: LoadBalancerProps;
    loadBalancer: IApplicationLoadBalancer;
    loadBalancerSecurityGroup: ISecurityGroup;
    listener: ApplicationListener;

    constructor(stack: Stack, props: LoadBalancerProps) {
        this.stack = stack;
        this.props = props;
    }

    create(): ElasticLoadBalancer {
        this.loadBalancerSecurityGroup = new SecurityGroup(this.stack, `${STACK_NAME}-lb-sg`, {
            securityGroupName: `${STACK_NAME}-sg`,
            description: "security group for load balancer",
            vpc: this.props.vpc,
            allowAllOutbound: true
        });
        this.loadBalancerSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow traffic on port 80");

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

        return this;
    }

    addListener(): ElasticLoadBalancer {
        this.listener = this.loadBalancer.addListener(`${STACK_NAME}-listener`, {
            port: 80,
            open: true,
        });
        this.listener.addAction("listener-action", {
            action: ListenerAction.fixedResponse(200, {
                contentType: "text/plain",
                messageBody: "xxx 12345 xxx"
            })
        });

        this.listener.node.addDependency(this.loadBalancer);
        return this;
    }

}