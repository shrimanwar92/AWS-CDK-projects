import {Stack} from "@aws-cdk/core";
import {Vpc, IVpc, SubnetType} from "@aws-cdk/aws-ec2";
import {STACK_NAME} from "./utils";

export class VPC {
    stack: Stack;
    vpc: IVpc;

    constructor(stack: Stack) {
        this.stack = stack;
        this.vpc = this.createVpc();
    }

    private createVpc(): IVpc {
        return new Vpc(this.stack, `${STACK_NAME}-vpc`, {
            cidr: "10.0.0.0/16",
            subnetConfiguration: [{
                cidrMask: 24,
                name: 'public',
                subnetType: SubnetType.PUBLIC
            },{
                cidrMask: 24,
                name: 'private',
                subnetType: SubnetType.PRIVATE
            }],
            natGateways: 2
        });
    }
}