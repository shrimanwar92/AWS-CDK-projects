import {Domain, ElasticsearchVersion} from "@aws-cdk/aws-elasticsearch";
import {Stack, RemovalPolicy, CfnOutput} from "@aws-cdk/core";
import {ICluster} from "@aws-cdk/aws-ecs";
import {IVpc, Port, SubnetType} from "@aws-cdk/aws-ec2";
import {STACK_NAME} from "./utils";
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

        const elasticSearch = new Domain(this.stack, `${STACK_NAME}-es`, {
            version: ElasticsearchVersion.V7_10,
            enableVersionUpgrade: true,
            vpc: this.props.vpc,
            vpcSubnets: [{ subnetType: SubnetType.PRIVATE }],
            removalPolicy: RemovalPolicy.DESTROY,
            accessPolicies: [
                new iam.PolicyStatement({
                    resources: [`arn:aws:es:${Stack.of(this.stack).region}:${Stack.of(this.stack).account}:domain/*`],
                    actions: ['es:*'],
                    effect: iam.Effect.ALLOW,
                    principals: [new iam.AnyPrincipal()]
                })
            ],
            zoneAwareness: {
                enabled: true,
            },
            capacity: {
                dataNodes: 2,
            },
            logging: {
                slowSearchLogEnabled: true,
                appLogEnabled: true,
                slowIndexLogEnabled: true,
            },
        });
        new CfnOutput(this.stack, 'Elastic search domain', { value: elasticSearch.domainEndpoint });
        elasticSearch.connections.allowFrom(this.props.cluster, Port.tcp(9200), "allow traffic from fargate cluster to elastic search");
        // elasticSearch.connections.allowFrom(Peer.ipv4(this.props.vpc.vpcCidrBlock), Port.allTcp());
        elasticSearch.node.addDependency(this.props.cluster);
        return elasticSearch;
    }
}