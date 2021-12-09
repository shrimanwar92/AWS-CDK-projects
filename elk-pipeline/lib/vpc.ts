import {IVpc, SubnetType, Vpc} from 'aws-cdk-lib/aws-ec2';
import {STACK_NAME} from "./utils";
import {Stack} from "aws-cdk-lib";

export default class VPC {
    readonly stack: Stack;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    create(): IVpc {
        return new Vpc(this.stack, `${STACK_NAME}-vpc`, {
            cidr: "10.0.0.0/16",
            maxAzs: 1,
            subnetConfiguration: [{
                cidrMask: 24,
                subnetType: SubnetType.PUBLIC,
                name: "public-subnet"
            }, {
                cidrMask: 24,
                subnetType: SubnetType.PRIVATE_WITH_NAT,
                name: 'private-subnet'
            }]
        });
    }
}