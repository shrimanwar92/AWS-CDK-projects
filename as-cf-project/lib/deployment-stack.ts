import {Construct, StackProps, Stack, CfnParameter, CfnOutput} from "@aws-cdk/core";
import VPC from "./vpc";
import {Port, IVpc, Vpc} from "@aws-cdk/aws-ec2";
import {IApplicationLoadBalancer} from "@aws-cdk/aws-elasticloadbalancingv2";
import {STACK_NAME, AVAILABILITY_ZONES} from "./utils";
import {IRepository} from "@aws-cdk/aws-ecr";
import ElasticLoadBalancer from "./elbv2";
import ECRRepository from "./repository";

export class DeploymentStack extends Stack {
    vpc: IVpc;
    loadBalancer: ElasticLoadBalancer;
    repository: IRepository;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        const repositoryName = new CfnParameter(this, "repositoryName", {
            type: "String",
            description: "Name of the AWS ECR repository with image (Repository name must start with a letter and can only contain lowercase letters, numbers, hyphens, underscores, and forward slashes)"
        }).valueAsString;


        // The code that defines your stack goes here
        this.vpc = this.createVpc();
        this.loadBalancer = new ElasticLoadBalancer(this, {vpc: this.vpc})
            .create()
            .addListener();
        this.repository = this.getRepository(repositoryName);

        this.logOutputs();
    }

    private getRepository(name: string): IRepository {
        const repo = new ECRRepository(this);

        if(name) {
            return repo.fetch(name);
        }
        return repo.create();
    }

    private createVpc() {
        const vpc = new VPC(this)
            .create()
            .createSubnets()
            .createInternetGateway()
            .createNatGateway()
            .createRouteTable();

        return Vpc.fromVpcAttributes(this, "vpcxyz", {
            vpcId: vpc.vpc.ref,
            availabilityZones: AVAILABILITY_ZONES,
            privateSubnetIds: vpc.subnets.private.map(subnet => subnet.ref),
            publicSubnetIds: vpc.subnets.public.map(subnet => subnet.ref)
        });
    }

    private logOutputs() {
        new CfnOutput(this, 'RepositoryUri', {
            value: this.repository.repositoryUri
        });
    }
}
