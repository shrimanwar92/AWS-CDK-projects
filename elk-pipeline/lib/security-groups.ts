import {IVpc, Peer, Port, SecurityGroup} from "aws-cdk-lib/aws-ec2";
import {MY_IP, STACK_NAME} from "./utils";
import {Stack} from "aws-cdk-lib";

export function createDefaultEC2SecurityGroup(stack: Stack, vpc: IVpc, name: string) {
    const ec2SG = new SecurityGroup(stack, `${STACK_NAME}-ec2-sg-${name}`, {
        securityGroupName: `${STACK_NAME}-ec2-sg-${name}`,
        description: "security group for ec2 instance",
        vpc,
        allowAllOutbound: true
    });

    ec2SG.addIngressRule(Peer.ipv4(MY_IP), Port.tcp(22), "allow ssh from my ip");
    ec2SG.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow all traffic on port 80");
    ec2SG.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "allow all traffic on port 443");

    return ec2SG;
}