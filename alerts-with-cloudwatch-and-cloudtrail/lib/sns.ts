import {Stack} from "@aws-cdk/core";
import {STACK_NAME, EMAIl} from "./utils";
import {ITopic, Topic} from "@aws-cdk/aws-sns";
import {EmailSubscription} from "@aws-cdk/aws-sns-subscriptions";

export default class SNS {
    topic: ITopic;

    constructor(stack: Stack) {
        this.topic = new Topic(stack, `${STACK_NAME}-topic`, {
            displayName: "ec2-count-topic",
            topicName: "ec2-count-topic"
        });

        this.topic.addSubscription(new EmailSubscription(EMAIl));
    }
}