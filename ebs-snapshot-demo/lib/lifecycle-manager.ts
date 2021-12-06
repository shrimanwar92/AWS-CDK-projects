import {Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {CfnLifecyclePolicy} from "@aws-cdk/aws-dlm";
import {ManagedPolicy, Role, ServicePrincipal} from "@aws-cdk/aws-iam";

export default class LifecycleManager {
    readonly stack: Stack;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    setupDML() {
        const dlmRole = new Role(this.stack, `${STACK_NAME}-dlm-role`, {
            roleName: `${STACK_NAME}-dlm-role`,
            assumedBy: new ServicePrincipal("dlm.amazonaws.com"),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName("service-role/AWSDataLifecycleManagerServiceRole")
            ]
        });
        
        new CfnLifecyclePolicy(this.stack, `${STACK_NAME}-dlm`, {
            description: 'ec2 ebs volume hourly backup',
            executionRoleArn: dlmRole.roleArn,
            policyDetails: {
                resourceTypes: ['VOLUME'],
                targetTags: [
                    { key: 'DLM', value: 'true' },
                ],
                schedules: [{
                    name: 'hourly snapshots',
                    createRule: { interval: 1, intervalUnit: 'HOURS', times: ["09:45"] }, // utc time
                    retainRule: { count: 1 },
                    copyTags: false,
                }]
            },
            state: 'ENABLED',
        });
    }
}