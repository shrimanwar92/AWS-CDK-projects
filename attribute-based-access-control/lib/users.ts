import {SecretValue, Stack, Tag} from "@aws-cdk/core";
import {IGroup, User} from "@aws-cdk/aws-iam";
import {STACK_NAME} from "./utils";

interface IamUserProps {
    group: IGroup
}

export default class IamUser {
    readonly stack: Stack;
    readonly props: IamUserProps;

    constructor(stack: Stack, props: IamUserProps) {
        this.stack = stack;
        this.props = props;
    }

    create(name: string): User {
        return new User(this.stack, `${STACK_NAME}-user-${name}`, {
            userName: name,
            groups: [this.props.group],
            password: SecretValue.plainText(`${STACK_NAME}@${name}A123`)
        });
    }
}