import {Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {ManagedPolicy, Role, IRole, ServicePrincipal} from "@aws-cdk/aws-iam";
import {
    ISecurityGroup,
    SecurityGroup,
    IVpc,
    UserData,
    Instance,
    InstanceType,
    InstanceClass, InstanceSize, AmazonLinuxImage
} from "@aws-cdk/aws-ec2";

interface EC2Props {
    vpc: IVpc
}

export class EC2 {
    stack: Stack;
    props: EC2Props;

    constructor(stack: Stack, props: EC2Props) {
        this.stack = stack;
        this.props = props;
    }

    createInstance(): Instance {
        const userData = UserData.forLinux();
        userData.addCommands(
            `yum install httpd -y`,
            `echo "<h1>Response from server</h1>" > /var/www/html/index.html`,
            `chkconfig httpd on`,
            `service httpd start`
        );

        const instance = new Instance(this.stack, `${STACK_NAME}-ec2`, {
            vpc: this.props.vpc,
            vpcSubnets: {
                subnets: this.props.vpc.privateSubnets
            },
            instanceName: `${STACK_NAME}-ec2-instance`,
            instanceType: InstanceType.of(InstanceClass.BURSTABLE2, InstanceSize.MICRO),
            machineImage: new AmazonLinuxImage(),
            userData: userData,
            role: this.role
        });

        instance.node.addDependency(this.props.vpc);

        return instance;
    }

    get role(): IRole {
        const role = new Role(this.stack, `${STACK_NAME}-ec2-role`, {
            roleName: `${STACK_NAME}-ec2-role`,
            assumedBy: new ServicePrincipal("ec2.amazonaws.com")
        });
        role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));

        return role;
    }
}