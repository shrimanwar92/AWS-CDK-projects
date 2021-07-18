import {Construct, StackProps, Stack, CfnParameter, CfnOutput, Fn} from "@aws-cdk/core";
import VPC from "./vpc";
import {Vpc} from "@aws-cdk/aws-ec2";
import {AVAILABILITY_ZONES, REPO_NAME} from "./utils";
import {IRepository} from "@aws-cdk/aws-ecr";
import ElasticLoadBalancer from "./elbv2";
import ECRRepository from "./repository";

// cdk deploy DeploymentStack --parameters repositoryName=1xxx

export class DeploymentStack extends Stack {
    vpc: any;
    loadBalancer: ElasticLoadBalancer;
    repository: IRepository;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        let repoName = new CfnParameter(this, "repositoryName", {
            type: "String",
            description: "Name of the AWS ECR repository with image (Repository name must start with a letter and can only contain lowercase letters, numbers, hyphens, underscores, and forward slashes)",
            constraintDescription: "Please provide a repository name to fetch.",
        }).valueAsString;

        // The code that defines your stack goes here
        this.vpc = this.createVpc();
        this.loadBalancer = new ElasticLoadBalancer(this, {
            vpc: this.vpc.vpc,
            gatewayAttachment: this.vpc.gatewayAttachment
        })
            .create()
            .addListener();

        this.repository = new ECRRepository(this).fetch(repoName);

        this.print();
    }

    private createVpc() {
        const vpcAttrs = new VPC(this)
            .create()
            .createSubnets()
            .createInternetGateway()
            .createNatGateway()
            .createRouteTable();

        const importedVpc = Vpc.fromVpcAttributes(this, "vpcxyz", {
            vpcId: vpcAttrs.cfnVpc.ref,
            availabilityZones: AVAILABILITY_ZONES,
            privateSubnetIds: vpcAttrs.subnets.private.map(subnet => subnet.ref),
            publicSubnetIds: vpcAttrs.subnets.public.map(subnet => subnet.ref)
        });
        vpcAttrs.vpc = importedVpc;

        return vpcAttrs;
    }

    print() {
        new CfnOutput(this, 'LoadBalancerDNS', {
            value: this.loadBalancer.loadBalancer.loadBalancerDnsName,
            description: 'load balancer DNS'
        });
    }
}
