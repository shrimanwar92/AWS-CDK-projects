import {Instance,
    InstanceType, IVpc,
    AmazonLinuxImage, SecurityGroup,
    UserData, Peer, Port} from "aws-cdk-lib/aws-ec2";
import {Role} from "aws-cdk-lib/aws-iam";
import {Stack} from "aws-cdk-lib";
import {STACK_NAME, KEY_PAIR_NAME, MY_IP} from "./utils";

interface Ec2InstanceProps {
    vpc: IVpc;
}

type Ec2Options = {
    name: string,
    instanceType: InstanceType,
    role: Role,
    securityGroup: SecurityGroup
}

export default class Ec2Instance {
    readonly stack: Stack;
    readonly props: Ec2InstanceProps;

    constructor(stack: Stack, props: Ec2InstanceProps) {
        this.stack = stack;
        this.props = props;
    }

    create(options: Ec2Options) {
        return new Instance(this.stack, `${STACK_NAME}-ec2-${options.name}`, {
            vpc: this.props.vpc,
            vpcSubnets: {
                subnets: this.props.vpc.publicSubnets
            },
            instanceName: `${STACK_NAME}-ec2-${options.name}`,
            instanceType: options.instanceType,
            machineImage: new AmazonLinuxImage(),
            role: options.role,
            userData: this.instanceUserData,
            securityGroup: options.securityGroup,
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
            'sudo chmod +x /usr/local/bin/docker-compose',
            'ln -s /usr/local/bin/docker-compose /usr/bin/docker-compose'
        );

        return userData;
    }
}