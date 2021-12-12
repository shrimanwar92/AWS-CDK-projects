import {
    AccountRootPrincipal,
    Effect,
    ManagedPolicy,
    PolicyStatement,
    Role,
    ServicePrincipal
} from "aws-cdk-lib/aws-iam";
import {STACK_NAME} from "./utils";
import {Stack} from "aws-cdk-lib";

export function createDefaultEC2Role(stack: Stack): Role {
    return new Role(stack, `${STACK_NAME}-ec2-role`, {
        roleName: `${STACK_NAME}-ec2-role`,
        assumedBy: new ServicePrincipal("ec2.amazonaws.com"),
        managedPolicies: [
            ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"),
            ManagedPolicy.fromAwsManagedPolicyName("CloudWatchAgentServerPolicy")
        ]
    });
}

export function createMetricBeatRole(stack: Stack): Role {
    const metricBeatRole = new Role(stack, 'MetricBeatRole', {
        roleName: 'metric-beat-role',
        description: 'Role required for metricbeat for gathering system information',
        assumedBy: new AccountRootPrincipal()
    });

    metricBeatRole.addToPolicy(new PolicyStatement({
        effect: Effect.ALLOW,
        actions: [
            "sts:AssumeRole",
            "sqs:ListQueues",
            "tag:GetResources",
            "ec2:DescribeInstances",
            "cloudwatch:GetMetricData",
            "ec2:DescribeRegions",
            "iam:ListAccountAliases",
            "sts:GetCallerIdentity",
            "cloudwatch:ListMetrics"
        ],
        resources: ["*"]
    }));

    return metricBeatRole;
}