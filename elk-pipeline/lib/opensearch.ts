import {Domain, EngineVersion} from 'aws-cdk-lib/aws-opensearchservice';
import {CfnOutput, RemovalPolicy, Stack} from "aws-cdk-lib";
import {STACK_NAME} from "./utils";

export default class OpenSearch {
    readonly stack: Stack;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    create() {
        const domain = new Domain(this.stack, `${STACK_NAME}-os-domain`, {
            version: EngineVersion.ELASTICSEARCH_7_10,
            removalPolicy: RemovalPolicy.DESTROY,
            capacity: {
                masterNodes: 1,
                masterNodeInstanceType: "t2.micro.search"
                //warmNodes: 2,
                //warmInstanceType: 't2.micro.search',
            }
        });

        new CfnOutput(this.stack, 'OpenSearch-domain', {
            value: domain.domainEndpoint
        });
    }
}