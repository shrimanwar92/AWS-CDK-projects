import {Instance, InstanceClass,
    InstanceType, IVpc, InstanceSize,
    AmazonLinuxImage, SecurityGroup,
    UserData, Peer, Port} from "aws-cdk-lib/aws-ec2";
import {Role, ServicePrincipal, ManagedPolicy} from "aws-cdk-lib/aws-iam";
import {Stack} from "aws-cdk-lib";
import {STACK_NAME} from "./utils";

interface Ec2InstanceProps {
    vpc: IVpc;
}

export default class Ec2Instance {
    readonly stack: Stack;
    readonly props: Ec2InstanceProps;

    constructor(stack: Stack, props: Ec2InstanceProps) {
        this.stack = stack;
        this.props = props;
    }

    create(name: string, userData: UserData) {
        const role = new Role(this.stack, `${STACK_NAME}-ec2-role`, {
            roleName: `${STACK_NAME}-ec2-role`,
            assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
                ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
            ]
        });

        const ec2SG = new SecurityGroup(this.stack, `${STACK_NAME}-ec2-sg`, {
            securityGroupName: `${STACK_NAME}-instance-sg`,
            description: "security group for ec2 instance",
            vpc: this.props.vpc,
            allowAllOutbound: true
        });

        //ec2SG.addIngressRule(Peer.ipv4(MY_IP), Port.tcp(22), "allow ssh from my ip");
        ec2SG.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow all traffic on port 80");
        ec2SG.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "allow all traffic on port 443");
        ec2SG.addIngressRule(Peer.anyIpv4(), Port.tcp(5044), "allow all traffic on port 5044 for filebeats");

        const instance = new Instance(this.stack, `${STACK_NAME}-ec2-${name}`, {
            vpc: this.props.vpc,
            vpcSubnets: {
                subnets: this.props.vpc.publicSubnets
            },
            instanceName: `${STACK_NAME}-ec2-${name}`,
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            machineImage: new AmazonLinuxImage(),
            role, userData,
            securityGroup: ec2SG,
            //keyName: EC2_KEY_PAIR_NAME
        });
    }
}