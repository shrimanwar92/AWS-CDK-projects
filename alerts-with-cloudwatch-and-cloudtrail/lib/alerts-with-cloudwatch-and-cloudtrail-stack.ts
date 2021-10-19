import {Stack, Construct, StackProps} from '@aws-cdk/core';
import MyVPC from "./vpc";
import Ec2Instance from "./instances";
import SNS from "./sns";
import MyCloudWatch from "./cloudwatch";

export class AlertsWithCloudwatchAndCloudtrailStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // get default vpc for simplicity
        const {vpc} = new MyVPC(this);

        // create 1 ec2 instance
        new Ec2Instance(this, {
            vpc: vpc, noOfInstances: 1
        }).create();

        // create SNS email subscription
        const {topic} = new SNS(this);

        // setup cloudtrail and cloudwatch metric for stopped instance
        const cw = new MyCloudWatch(this);
        cw.createTrail();
        cw.createMetricFilter();
        cw.createAlarm(topic);
    }
}
