import {Domain, ElasticsearchVersion} from "@aws-cdk/aws-elasticsearch";
import {Stack, RemovalPolicy, CfnOutput, SecretValue} from "@aws-cdk/core";
import {ICluster} from "@aws-cdk/aws-ecs";
import {IVpc, Peer, SecurityGroup, Port} from "@aws-cdk/aws-ec2";
import {STACK_NAME, ELASTIC_SEARCH} from "./utils";
import * as iam from '@aws-cdk/aws-iam';

interface ElasticSearchProps {
    cluster: ICluster,
    vpc: IVpc
}

export default class ElasticSearch {
    readonly stack: Stack;
    readonly props: ElasticSearchProps;

    constructor(stack: Stack, props: ElasticSearchProps) {
        this.stack = stack;
        this.props = props;
    }

    createElasticSearchDomain(): Domain {
        new iam.CfnServiceLinkedRole(this.stack, `${STACK_NAME}-es-slr`, {
            awsServiceName: 'es.amazonaws.com',
            description: 'Elastic Search service linked role',
        });

        // Allow private traffic
        const esSecurityGroup = new SecurityGroup(this.stack, `${STACK_NAME}-es-sg`, {
            vpc: this.props.vpc,
            allowAllOutbound: true,
            securityGroupName: `${STACK_NAME}-es-sg`
        });
        esSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "Allow access to port 80");
        esSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "Allow access to port 443");

        const elasticSearch = new Domain(this.stack, `${STACK_NAME}-es`, {
            version: ElasticsearchVersion.V7_10,
            enableVersionUpgrade: true,
            removalPolicy: RemovalPolicy.DESTROY,
            accessPolicies: [
                new iam.PolicyStatement({
                    resources: [`arn:aws:es:${Stack.of(this.stack).region}:${Stack.of(this.stack).account}:domain/*`],
                    actions: ['es:*'],
                    effect: iam.Effect.ALLOW,
                    principals: [new iam.AnyPrincipal()],
                    /*conditions: {
                        IpAddress: {
                            "aws:SourceIp": ELASTIC_SEARCH.IP
                        }
                    }*/
                })
            ],
            /*zoneAwareness: {
                enabled: true,
                availabilityZoneCount: 2,
            },*/
            vpc: this.props.vpc,
            vpcSubnets: [{
                subnets: [this.props.vpc.privateSubnets[0]]
            }],
            securityGroups: [esSecurityGroup],
            capacity: {
                dataNodes: 1,
                //masterNodes: 1,
                dataNodeInstanceType: "t3.small.elasticsearch",
                //masterNodeInstanceType: "t3.small.elasticsearch",

            },
            /*logging: {
                slowSearchLogEnabled: true,
                appLogEnabled: true,
                slowIndexLogEnabled: true,
            }*/
        });
        new CfnOutput(this.stack, 'Elastic search domain', { value: elasticSearch.domainEndpoint });
        elasticSearch.node.addDependency(this.props.cluster);
        return elasticSearch;
    }
}