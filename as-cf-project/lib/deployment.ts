import {Construct, StackProps, Stack, CfnParameter} from "@aws-cdk/core";
import VPC from "./vpc";
import {Port, IVpc, Vpc} from "@aws-cdk/aws-ec2";
import {IApplicationLoadBalancer} from "@aws-cdk/aws-elasticloadbalancingv2";
import {STACK_NAME, AVAILABILITY_ZONES} from "./utils";
import {IRepository} from "@aws-cdk/aws-ecr";
import ElasticLoadBalancer from "./elbv2";
import Container from "./container";
import ECRRepository from "./repository";

export class DeploymentStack extends Stack {
    vpc: IVpc;
    loadBalancer: ElasticLoadBalancer;
    container: Container;
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
        this.container = new Container(this, {vpc: this.vpc, repository: this.repository})
            .createFromRepository()
    }

    private getRepository(name: string): IRepository {
        const repoInstance = new ECRRepository(this);

        if(name) {
            return repoInstance.fetch(name);
        }
        return repoInstance.create();
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
}
