import {
    ApplicationListener,
    ApplicationLoadBalancer,
    ContentType,
    IApplicationListener,
    IApplicationLoadBalancer,
    ListenerAction
} from "@aws-cdk/aws-elasticloadbalancingv2";
import {Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";

interface LoadBalancerProps {
    vpc: IVpc
}

export interface CustomApplicationLoadBalancer {
    loadBalancer: IApplicationLoadBalancer,
    listener: IApplicationListener,
    loadBalancerSecurityGroup: ISecurityGroup
}

export class ALB {
    stack: Stack;
    props: LoadBalancerProps;

    constructor(stack: Stack, props: LoadBalancerProps) {
        this.stack = stack;
        this.props = props;
    }

    create(): CustomApplicationLoadBalancer {
        const lbSecurityGroup: ISecurityGroup = new SecurityGroup(this.stack, `${STACK_NAME}-lb-sg`, {
            securityGroupName: `${STACK_NAME}-sg`,
            description: "security group for load balancer",
            vpc: this.props.vpc,
            allowAllOutbound: true
        });
        lbSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow traffic on port 80");

        const lb = new ApplicationLoadBalancer(this.stack, `${STACK_NAME}-lb`, {
            loadBalancerName: `${STACK_NAME}-lb`,
            vpc: this.props.vpc,
            internetFacing: true,
            securityGroup: lbSecurityGroup,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC
            }
        });
        // wait for vpc and security group to be created first
        lb.node.addDependency(this.props.vpc);
        lb.node.addDependency(lbSecurityGroup);
        const listener = this.createListener(lb);

        return {
            loadBalancer: lb,
            listener,
            loadBalancerSecurityGroup: lbSecurityGroup
        };
    }

    private createListener(lb: IApplicationLoadBalancer): ApplicationListener {
        const listener = lb.addListener(`${STACK_NAME}-listener`, {
            port: 80,
            open: true,
        });
        listener.addAction("listener-action", {
            action: ListenerAction.fixedResponse(200, {
                contentType: ContentType.TEXT_PLAIN,
                messageBody: "AAAAAAA RRRRRRR RRRRRRR AAAAAAAAAA"
            })
        });

        return listener;
    }

}