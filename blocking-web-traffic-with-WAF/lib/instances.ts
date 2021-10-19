import {
    Instance,
    Vpc,
    IVpc,
    InstanceClass,
    InstanceSize,
    AmazonLinuxImage,
    InstanceType,
    CfnInstance, SecurityGroup, Port, UserData, ISecurityGroup
} from "@aws-cdk/aws-ec2";
import {Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {ManagedPolicy, Role, ServicePrincipal} from "@aws-cdk/aws-iam";

interface Ec2InstanceProps{
    loadBalancerSG: ISecurityGroup,
    vpc: IVpc,
    noOfInstances: number
}

export default class Ec2Instance {
    readonly stack: Stack;
    readonly props: Ec2InstanceProps;

    constructor(stack: Stack, props: Ec2InstanceProps) {
        this.stack = stack;
        this.props = props;
    }

    create(): CfnInstance[] {
        const role = new Role(this.stack, `${STACK_NAME}-ec2-role`, {
            roleName: `${STACK_NAME}-ec2-role`,
            assumedBy: new ServicePrincipal("ec2.amazonaws.com")
        });
        role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));

        const ec2SG = new SecurityGroup(this.stack, `${STACK_NAME}-ec2-sg`, {
            securityGroupName: `${STACK_NAME}-instance-sg`,
            description: "security group for ec2 instance",
            vpc: this.props.vpc,
            allowAllOutbound: true
        });
        ec2SG.node.addDependency(this.props.loadBalancerSG);
        ec2SG.connections.allowFrom(this.props.loadBalancerSG, Port.tcp(80), "allow conn from lb-security-grp to ec2-security-grp");

        return Array(this.props.noOfInstances).fill('instance', 0)
            .map((inst, index) => {
                const userData = UserData.forLinux();
                userData.addCommands(
                    `yum install httpd -y`,
                    `echo "<h1>Response from server ${inst}-${index+1}</h1>" > /var/www/html/index.html`,
                    `chkconfig httpd on`,
                    `service httpd start`
                );

                const instance = new Instance(this.stack, `${STACK_NAME}-ec2-${index}`, {
                    vpc: this.props.vpc,
                    vpcSubnets: {
                        subnets: this.props.vpc.publicSubnets
                    },
                    instanceName: `${STACK_NAME}-ec2-${index}`,
                    instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
                    machineImage: new AmazonLinuxImage(),
                    userData,
                    securityGroup: ec2SG
                }).instance;

                instance.node.addDependency(this.props.vpc);
                return instance;
            });
    }
}