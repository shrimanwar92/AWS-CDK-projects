import {
    Instance,
    Vpc,
    IVpc,
    InstanceClass,
    InstanceSize,
    AmazonLinuxImage,
    InstanceType,
    CfnInstance
} from "@aws-cdk/aws-ec2";
import {Stack} from "@aws-cdk/core";
import {STACK_NAME, VPC_ID} from "./utils";

interface Ec2InstanceProps{}

export default class Ec2Instance {
    readonly stack: Stack;
    // readonly props: Ec2InstanceProps;
    vpc: IVpc;

    constructor(stack: Stack) {
        this.stack = stack;

        this.vpc = Vpc.fromLookup(stack, `${STACK_NAME}-vpc`, {
            isDefault: true,
            vpcId: VPC_ID
        });
    }

    create(name: string): CfnInstance {
        const instance = new Instance(this.stack, `${STACK_NAME}-ec2-${name}`, {
            vpc: this.vpc,
            vpcSubnets: {
                subnets: this.vpc.publicSubnets
            },
            instanceName: `${STACK_NAME}-${name}`,
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            machineImage: new AmazonLinuxImage()
        }).instance;

        instance.node.addDependency(this.vpc);
        return instance;
    }
}