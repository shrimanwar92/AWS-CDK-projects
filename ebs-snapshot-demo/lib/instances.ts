import {
    AmazonLinuxImage,
    CfnInstance,
    EbsDeviceVolumeType,
    Instance,
    InstanceClass,
    InstanceSize,
    InstanceType,
    IVpc,
    Peer,
    Port,
    SecurityGroup,
    Volume, CfnVolumeAttachment
} from "@aws-cdk/aws-ec2";
import {CfnOutput, RemovalPolicy, Size, Stack} from "@aws-cdk/core";
import {EC2_KEY_PAIR_NAME, MY_IP, STACK_NAME} from "./utils";
import {ManagedPolicy, Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import CustomResource from "./custom-resource";

interface Ec2InstanceProps{
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

        ec2SG.addIngressRule(Peer.ipv4(MY_IP), Port.tcp(22), "allow ssh from my ip");
        ec2SG.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow all traffic on port 80");

        return Array(this.props.noOfInstances).fill('instance', 0)
            .map((inst, index) => {

                const instance = new Instance(this.stack, `${STACK_NAME}-ec2-${index}`, {
                    vpc: this.props.vpc,
                    vpcSubnets: {
                        subnets: this.props.vpc.publicSubnets
                    },
                    instanceName: `${STACK_NAME}-ec2-${index}`,
                    instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
                    machineImage: new AmazonLinuxImage(),
                    role,
                    securityGroup: ec2SG,
                    keyName: EC2_KEY_PAIR_NAME
                });

                instance.node.addDependency(this.props.vpc);

                if(index === 0) {
                    this.createVolume(instance);
                    instance.addUserData(
                        `#!/bin/bash`,
                        `yum install httpd -y`,
                        `echo "<h1>Response from server ${inst}-${index+1}</h1>" > /var/www/html/index.html`,
                        `chkconfig httpd on`,
                        `service httpd start`,
                        `sudo su`,
                        `sudo mkfs -t ext4 /dev/xvdm`,
                        `sudo mkdir m-drive`,
                        `sudo mount /dev/xvdm m-drive/`,
                        `cd /home/ec2-user/m-drive/`,
                        `touch file.txt`
                    );
                } else {
                    instance.addUserData(
                        `#!/bin/bash`,
                        `yum install httpd -y`,
                        `echo "<h1>Response from server ${inst}-${index+1}</h1>" > /var/www/html/index.html`,
                        `chkconfig httpd on`,
                        `service httpd start`
                    );
                }

                new CfnOutput(this.stack, `Instance-${index} Public IP`, {
                    value: instance.instancePublicIp
                });
                return instance.instance;
            });
    }

    createVolume(instance: Instance) {
        const volume = new Volume(this.stack, `${STACK_NAME}-volume`, {
            volumeName: `${STACK_NAME}-volume`,
            availabilityZone: instance.instanceAvailabilityZone,
            volumeType: EbsDeviceVolumeType.GP3,
            removalPolicy: RemovalPolicy.DESTROY,
            size: Size.gibibytes(8)
        });

        volume.node.addDependency(instance);

        new CfnVolumeAttachment(this.stack, `${STACK_NAME}-vol-att`, {
            instanceId: instance.instanceId,
            volumeId: volume.volumeId,
            device: "/dev/sdm"
        });

        const snapshot = new CustomResource(this.stack).createSnapshot(volume.volumeId);
        snapshot.node.addDependency(volume);
    }
}