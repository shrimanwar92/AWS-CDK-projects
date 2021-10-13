import {Construct, StackProps, Stack, Tags} from '@aws-cdk/core';
import IamGroup from "./groups";
import IamUser from "./users";
import {Effect, Group, IGroup, PolicyStatement} from "@aws-cdk/aws-iam";
import Ec2Instance from "./instances";

export class AttributeBasedAccessControlStack extends Stack {
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.createDevUser();
        this.createTestUser();
        this.createInstances();
    }

    private createInstances() {
        const instance = new Ec2Instance(this);

        ["dev1", "dev2", "test1", "test2"].forEach(name => {
            const ec2 = instance.create(name);
            name.includes("dev") && Tags.of(ec2).add("team", "developers");
            name.includes("test") && Tags.of(ec2).add("team", "testers");
        });
    }

    private createTestUser() {
        const test = new IamGroup(this).create("testers");

        const userTest = new IamUser(this, {group: test}).create("bob");
        userTest.addToPolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "ec2:RebootInstances",
                "ec2:StartInstances",
                "ec2:StopInstances"
            ],
            resources: ["*"],
            conditions: {
                StringEquals: {
                    "ec2:ResourceTag/team": "testers"
                }
            }
        }));
    }

    private createDevUser() {
        const dev = new IamGroup(this).create("developers");

        // create user alice
        const userDev = new IamUser(this, {group: dev}).create("alice");
        userDev.addToPolicy(new PolicyStatement({
            effect: Effect.ALLOW,
            actions: [
                "ec2:RebootInstances",
                "ec2:StartInstances",
                "ec2:StopInstances"
            ],
            resources: ["*"],
            conditions: {
                StringEquals: {
                    "ec2:ResourceTag/team": "developers"
                }
            }
        }));
    }
}
