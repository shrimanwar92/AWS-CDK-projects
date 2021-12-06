import {Domain, EngineVersion} from 'aws-cdk-lib/aws-opensearchservice';
import {CfnOutput, RemovalPolicy, Stack} from "aws-cdk-lib";
import * as iam from 'aws-cdk-lib/aws-iam';
import {
    SecurityGroup,
    Peer,
    Port,
    IVpc,
    Instance,
    InstanceType, InstanceClass, InstanceSize, AmazonLinuxImage
} from "aws-cdk-lib/aws-ec2";
import {STACK_NAME} from "./utils";
import {Role} from "aws-cdk-lib/aws-iam";
import {inspect} from "util";

interface OpenSearchProps {
    vpc: IVpc;
}

type OpenSearchResponse = {
    domain: Domain,
    osSG: SecurityGroup
}

export default class OpenSearch {
    readonly stack: Stack;
    readonly props: OpenSearchProps;

    constructor(stack: Stack, props: OpenSearchProps) {
        this.stack = stack;
        this.props = props;
    }

    create(): OpenSearchResponse {
        const osSecurityGroup = new SecurityGroup(this.stack, `${STACK_NAME}-os-sg`, {
            vpc: this.props.vpc,
            allowAllOutbound: true,
            securityGroupName: `${STACK_NAME}-es-sg`
        });
        osSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "Allow access to port 80");
        osSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "Allow access to port 443");

        const domain = new Domain(this.stack, `${STACK_NAME}-os-domain`, {
            version: EngineVersion.OPENSEARCH_1_0,
            removalPolicy: RemovalPolicy.DESTROY,
            domainName: `${STACK_NAME}-oss-1`,
            capacity: {
                //masterNodes: 1,
                //masterNodeInstanceType: "t2.micro.search",
                // must be an even number since the default az count is 2.
                dataNodes: 1, // in our case azs is 1
                dataNodeInstanceType: "t2.small.search"
                //warmNodes: 2,
                //warmInstanceType: 't2.micro.search',
            },
            accessPolicies: [
                new iam.PolicyStatement({
                    resources: [`arn:aws:es:${Stack.of(this.stack).region}:${Stack.of(this.stack).account}:domain/*`],
                    actions: ['es:*'],
                    effect: iam.Effect.ALLOW,
                    principals: [new iam.AnyPrincipal()]
                })
            ],
            vpc: this.props.vpc,
            vpcSubnets: [{ subnets: this.props.vpc.publicSubnets }],
            securityGroups: [osSecurityGroup],
        });

        new CfnOutput(this.stack, 'OpenSearch-domain', {
            value: domain.domainEndpoint
        });

        return { domain, osSG: osSecurityGroup };
    }

    createInstanceToAccessOpenSearch(osSG: SecurityGroup ) {
        const osInstance = new Instance(this.stack, `${STACK_NAME}-oss-ec2`, {
            vpc: this.props.vpc,
            vpcSubnets: {
                subnets: this.props.vpc.publicSubnets
            },
            instanceName: `${STACK_NAME}-oss-ec2`,
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            machineImage: new AmazonLinuxImage(),
            securityGroup: osSG,
            role: new Role(this.stack, `${STACK_NAME}-oss-ec2-role`, {
                assumedBy: new iam.ServicePrincipal('ec2.amazonaws.com')
            }),
            keyName: "my-key-pair"
        });

        new CfnOutput(this.stack, 'OpenSearch-ec2-instance', {
            value: osInstance.instancePublicIp
        });
    }
}