import {Construct, StackProps, Stack, CfnParameter} from "@aws-cdk/core";
import VPC, {VPCProps} from "./vpc";
import {IVpc} from "@aws-cdk/aws-ec2";
import {AVAILABILITY_ZONES, STACK_NAME} from "./utils";
import {IRepository} from "@aws-cdk/aws-ecr";
import ElasticLoadBalancer from "./elbv2";
import ECRRepository from "./repository";

// cdk deploy DeploymentStack --parameters repositoryName=1xxx

export class DeploymentStack extends Stack {
    vpcAttrs: VPCProps;
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
        this.vpcAttrs = new VPC(this).create();
        this.loadBalancer = new ElasticLoadBalancer(this, {
            vpc: this.vpcAttrs.vpc,
            gatewayAttachment: this.vpcAttrs.gatewayAttachment
        }).create();
        this.repository = new ECRRepository(this).fetch(repoName);
    }
}
