import {Stack} from "aws-cdk-lib";
import {AwsCustomResource} from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";

export default class CustomResource {
    readonly stack: Stack;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    createSGIngressToLogstash(securityGroupIdOss: string, instanceIP: string, name: string): AwsCustomResource {
        return new AwsCustomResource(this.stack, `SGIngress${name}`, {
            resourceType: `Custom::SGIngress${name}`,
            onCreate: {
                service: "EC2",
                action: "authorizeSecurityGroupIngress",
                parameters: {
                    GroupId: securityGroupIdOss,
                    IpPermissions: [{
                        FromPort: 5044,
                        IpProtocol: "tcp",
                        ToPort: 5044,
                        IpRanges: [{
                            CidrIp: `${instanceIP}/32`,
                            Description: "allow traffic to logstash"
                        }]
                    }]
                },
                physicalResourceId: {
                    id: Date.now().toString()
                }
            },
            policy: {
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: [
                            "ec2:AuthorizeSecurityGroupIngress",
                            "ec2:RevokeSecurityGroupIngress",
                            "ec2:AuthorizeSecurityGroupEgress",
                            "ec2:RevokeSecurityGroupEgress",
                            "ec2:ModifySecurityGroupRules",
                            "ec2:UpdateSecurityGroupRuleDescriptionsIngress",
                            "ec2:UpdateSecurityGroupRuleDescriptionsEgress"
                        ],
                        resources: ["*"]
                    })
                ]
            }
        })
    }
}