import * as cdk from '@aws-cdk/core';
import MyVPC from "./vpc";
import Ec2Instance from "./instances";

export class EbsSnapshotDemoStack extends cdk.Stack {
    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here
        // get default vpc for simplicity
        const {vpc} = new MyVPC(this);

        // create 2 ec2 instance
        new Ec2Instance(this, {
            vpc: vpc, noOfInstances: 2
        }).create();
    }
}
