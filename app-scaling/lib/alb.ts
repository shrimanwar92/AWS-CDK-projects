import {Duration, Stack} from "@aws-cdk/core";
import {
    ApplicationListener,
    ApplicationLoadBalancer,
    ApplicationTargetGroup,
    ContentType,
    IApplicationListener,
    IApplicationLoadBalancer,
    IApplicationTargetGroup,
    ListenerAction, ListenerCondition,
    TargetType
} from "@aws-cdk/aws-elasticloadbalancingv2";
import {ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";
import {STACK_NAME} from "./utils";

interface ALBProps {
    vpc: IVpc;
}

export interface CustomApplicationLoadBalancer {
    applicationLoadBalancer: IApplicationLoadBalancer,
    albSecurityGroup: ISecurityGroup,
    listener: IApplicationListener,
    targetGroup: IApplicationTargetGroup
}

export class ALB {
    stack: Stack;
    props: ALBProps;

    constructor(stack: Stack, props: ALBProps) {
        this.stack = stack;
        this.props = props;
    }

    createLoadBalancer(): CustomApplicationLoadBalancer {
        const albSecurityGroup = this.createSecurityGroup();
        const applicationLoadBalancer = new ApplicationLoadBalancer(this.stack, `${STACK_NAME}-alb`, {
            loadBalancerName: `${STACK_NAME}-alb`,
            vpc: this.props.vpc,
            vpcSubnets: {
                subnetType: SubnetType.PUBLIC
            },
            internetFacing: true,
            securityGroup: albSecurityGroup
        });
        applicationLoadBalancer.node.addDependency(this.props.vpc);
        applicationLoadBalancer.node.addDependency(albSecurityGroup);

        const targetGroup = this.createTargetGroup();
        const listener = this.createApplicationListener(applicationLoadBalancer, targetGroup);

        return {
            applicationLoadBalancer,
            albSecurityGroup,
            listener,
            targetGroup
        };
    }

    private createSecurityGroup(): ISecurityGroup {
        const securityGroup = new SecurityGroup(this.stack, `${STACK_NAME}-sg`, {
            securityGroupName: `${STACK_NAME}-alb-sg`,
            description: "Security group for application load balancer",
            vpc: this.props.vpc,
            allowAllOutbound: true
        });
        securityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow all traffic on port 80");
        return securityGroup;
    }

    private createApplicationListener(alb: IApplicationLoadBalancer, targetGroup: IApplicationTargetGroup): IApplicationListener {
        const listener = new ApplicationListener(this.stack, `${STACK_NAME}-listener`, {
            loadBalancer: alb,
            open: true,
            port: 80,
            defaultAction: ListenerAction.fixedResponse(200, {
                contentType: ContentType.TEXT_PLAIN,
                messageBody: "The loadbalancer is working...."
            })
        });
        listener.node.addDependency(targetGroup);
        listener.node.addDependency(alb);
        listener.addTargetGroups(`${STACK_NAME}-tg12`, {
            priority: 1,
            targetGroups: [targetGroup],
            conditions: [
                ListenerCondition.pathPatterns(['/'])
            ]
        });
        return listener;
    }

    private createTargetGroup(): IApplicationTargetGroup {
        const targetGroup = new ApplicationTargetGroup(this.stack, `${STACK_NAME}-tg`, {
            targetGroupName: `${STACK_NAME}-tg`,
            port: 80,
            healthCheck: {
                path: "/",
                interval: Duration.seconds(30)
            },
            vpc: this.props.vpc
        });

        return targetGroup;
    }
}