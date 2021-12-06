import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
// import * as sqs from 'aws-cdk-lib/aws-sqs';
import VPC from "./vpc";
import OpenSearch from "./opensearch";

export class ElkPipelineStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        // The code that defines your stack goes here

        // example resource
        // const queue = new sqs.Queue(this, 'ElkPipelineQueue', {
        //   visibilityTimeout: cdk.Duration.seconds(300)
        // });
        const vpc = new VPC(this).create();

        const oss = new OpenSearch(this, {vpc});
        const {osSG} = oss.create();
        oss.createInstanceToAccessOpenSearch(osSG);
    }
}
