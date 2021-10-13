import {Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {Effect, Group, IGroup, PolicyStatement} from "@aws-cdk/aws-iam";

export default class IamGroup {
    readonly stack: Stack;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    create(name: string): IGroup {
        const group = new Group(this.stack, `${STACK_NAME}-group-${name}`, {
            groupName: `${STACK_NAME}-group-${name}`
        });

        group.addToPolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "ec2:Describe*"
            ],
            resources: ["*"]
        }));

        return group;
    }
}