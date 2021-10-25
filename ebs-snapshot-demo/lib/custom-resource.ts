import {Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {AwsCustomResource} from "@aws-cdk/custom-resources";
import * as iam from "@aws-cdk/aws-iam";

export default class CustomResource {
    readonly stack: Stack;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    createSnapshot(volumeId: string): AwsCustomResource {
        const cs = new AwsCustomResource(this.stack, `${STACK_NAME}-cs`, {
            resourceType: "Custom::EBSCreateSnapshot",
            onCreate: {
                service: "EC2",
                action: "createSnapshot",
                parameters: {
                    Description: "my ebs snapshot",
                    VolumeId: volumeId
                },
                physicalResourceId: {
                    id: Date.now().toString()
                }
            },
            policy: {
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["*"],
                        resources: ["*"]
                    })
                ]
            }
        });

        return cs;
    }
}