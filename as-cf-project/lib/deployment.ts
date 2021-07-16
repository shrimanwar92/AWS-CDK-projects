import {Construct, StackProps, Stack} from "@aws-cdk/core";
import VPC from "./vpc";
import {Port, IVpc, Vpc} from "@aws-cdk/aws-ec2";
import {IApplicationLoadBalancer} from "@aws-cdk/aws-elasticloadbalancingv2";
import {STACK_NAME, AVAILABILITY_ZONES} from "./utils";
import ElasticLoadBalancer from "./elbv2";

export class DeploymentStack extends Stack {
    vpc: IVpc;
    loadBalancer: ElasticLoadBalancer;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);


        // The code that defines your stack goes here
        this.vpc = this.createVpc();
        this.loadBalancer = new ElasticLoadBalancer(this, {vpc: this.vpc})
            .create()
            .addListener();
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
