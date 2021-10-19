import {Stack} from "@aws-cdk/core";
import {Vpc, IVpc} from "@aws-cdk/aws-ec2";
import {STACK_NAME, VPC_ID} from "./utils";

export default class MyVPC {
    vpc: IVpc;
    constructor(stack: Stack) {
        this.vpc = Vpc.fromLookup(stack, `${STACK_NAME}-vpc`, {
            isDefault: true,
            vpcId: VPC_ID
        });
    }
}