import {Instance, InstanceClass,
    InstanceType, IVpc, InstanceSize,
    AmazonLinuxImage, SecurityGroup,
    UserData, Peer, Port} from "aws-cdk-lib/aws-ec2";
import {Role, ServicePrincipal, ManagedPolicy} from "aws-cdk-lib/aws-iam";
import {Stack} from "aws-cdk-lib";
import {STACK_NAME, KEY_PAIR_NAME, MY_IP} from "./utils";

interface Ec2InstanceProps {
    vpc: IVpc;
}

type ec2Options = {
    name: string,
    securityGroup?: SecurityGroup,
    instanceType: InstanceType
}

export default class Ec2Instance {
    readonly stack: Stack;
    readonly props: Ec2InstanceProps;

    constructor(stack: Stack, props: Ec2InstanceProps) {
        this.stack = stack;
        this.props = props;
    }

    create(options: ec2Options) {
        const role = new Role(this.stack, `${STACK_NAME}-ec2-role-${options.name}`, {
            roleName: `${STACK_NAME}-ec2-role-${options.name}`,
            assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
                ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
            ]
        });

        const ec2SG = options.securityGroup || new SecurityGroup(this.stack, `${STACK_NAME}-ec2-sg-${options.name}`, {
            securityGroupName: `${STACK_NAME}-instance-sg--${options.name}`,
            description: "security group for ec2 instance",
            vpc: this.props.vpc,
            allowAllOutbound: true
        });

        ec2SG.addIngressRule(Peer.ipv4(MY_IP), Port.tcp(22), "allow ssh from my ip");
        ec2SG.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow all traffic on port 80");
        ec2SG.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "allow all traffic on port 443");

        return new Instance(this.stack, `${STACK_NAME}-ec2-${options.name}`, {
            vpc: this.props.vpc,
            vpcSubnets: {
                subnets: this.props.vpc.publicSubnets
            },
            instanceName: `${STACK_NAME}-ec2-${options.name}`,
            instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
            machineImage: new AmazonLinuxImage(),
            role,
            userData: this.instanceUserData,
            securityGroup: ec2SG,
            keyName: KEY_PAIR_NAME
        });
    }

    private get instanceUserData() {
        const userData = UserData.forLinux();

        userData.addCommands(
            'sudo yum update -y',
            'sudo yum install -y docker',
            'sudo service docker start',
            'sudo usermod -a -G docker ec2-user',
            'sudo curl -L "https://github.com/docker/compose/releases/download/1.29.2/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose',
            'sudo chmod +x /usr/local/bin/docker-compose'
        );

        return userData;
    }
}