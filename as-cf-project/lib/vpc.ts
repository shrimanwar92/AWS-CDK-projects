import {Stack} from '@aws-cdk/core';
import {
    CfnVPC,
    CfnInternetGateway, CfnVPCGatewayAttachment,
    CfnNatGateway,
    CfnEIP,
    CfnRouteTable, CfnRoute, CfnSubnet, CfnSubnetRouteTableAssociation, IVpc, Vpc
} from "@aws-cdk/aws-ec2";
import {STACK_NAME, AVAILABILITY_ZONES} from "./utils";

type Subnets = {
    public: CfnSubnet[],
    private: CfnSubnet[]
}

export interface VPCProps {
    vpc: IVpc,
    gatewayAttachment: CfnVPCGatewayAttachment
}

export default class VPC {
    readonly stack: Stack;
    subnets: Subnets;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    create(): VPCProps {
        const cfnVpc = new CfnVPC(this.stack, `${STACK_NAME}-vpc`, {
            cidrBlock: "10.0.0.0/16",
            enableDnsSupport: true,
            enableDnsHostnames: true,
            tags: [{key: "VpcName", value: `${STACK_NAME}-vpc`}]
        });

        this.subnets = this.createSubnets(cfnVpc);
        const {internetGateway, gatewayAttachment} = this.createInternetGateway(cfnVpc);
        this.createPublicRouteTable(cfnVpc, internetGateway, gatewayAttachment);

        const nat = this.createNatGateway();
        this.createPrivateRouteTable(cfnVpc, nat);

        const vpc = Vpc.fromVpcAttributes(this.stack, `${STACK_NAME}-import-vpc`, {
            vpcId: cfnVpc.ref,
            availabilityZones: AVAILABILITY_ZONES,
            privateSubnetIds: this.subnets.private.map(subnet => subnet.ref),
            publicSubnetIds: this.subnets.public.map(subnet => subnet.ref),
            vpcCidrBlock: "10.0.0.0/16"
        });

        return {vpc, gatewayAttachment};
    }

    private createSubnets(vpc: CfnVPC) {
        const publicSubnet1 = new CfnSubnet(this.stack, `${STACK_NAME}-public-subnet1`, {
            vpcId: vpc.ref,
            availabilityZone: AVAILABILITY_ZONES[0],
            cidrBlock: '10.0.1.0/24'
        });
        const publicSubnet2 = new CfnSubnet(this.stack, `${STACK_NAME}-public-subnet2`, {
            vpcId: vpc.ref,
            availabilityZone: AVAILABILITY_ZONES[1],
            cidrBlock: '10.0.2.0/24'
        });
        const privateSubnet1 = new CfnSubnet(this.stack, `${STACK_NAME}-private-subnet1`, {
            vpcId: vpc.ref,
            availabilityZone: AVAILABILITY_ZONES[0],
            cidrBlock: '10.0.3.0/24'
        });
        const privateSubnet2 = new CfnSubnet(this.stack, `${STACK_NAME}-private-subnet2`, {
            vpcId: vpc.ref,
            availabilityZone: AVAILABILITY_ZONES[1],
            cidrBlock: '10.0.4.0/24'
        });

        publicSubnet1.addDependsOn(vpc);
        privateSubnet1.addDependsOn(vpc);
        publicSubnet2.addDependsOn(vpc);
        privateSubnet2.addDependsOn(vpc);

        return {
            public: [publicSubnet1, publicSubnet2],
            private: [privateSubnet1, privateSubnet2]
        };
    }

    private createInternetGateway(vpc: CfnVPC): {internetGateway: CfnInternetGateway, gatewayAttachment: CfnVPCGatewayAttachment} {
        const igw = new CfnInternetGateway(this.stack, `${STACK_NAME}-igw`, {
            tags: [{key: "IGW", value: `${STACK_NAME}-igw`}]
        });
        const gatewayAtt = new CfnVPCGatewayAttachment(this.stack, `${STACK_NAME}-igw-attachment`, {
            vpcId: vpc.ref,
            internetGatewayId: igw.ref
        });

        igw.addDependsOn(this.subnets.public[0]);
        igw.addDependsOn(this.subnets.public[1]);
        gatewayAtt.addDependsOn(igw);
        gatewayAtt.addDependsOn(vpc);

        return {internetGateway: igw, gatewayAttachment: gatewayAtt};
    }

    private createNatGateway(): CfnNatGateway {
        const eip = new CfnEIP(this.stack, `${STACK_NAME}-eip`, {
            domain: "vpc"
        });
        /*eip.addDependsOn(igw);
        eip.addDependsOn(gatewayAtt);*/

        const nat = new CfnNatGateway(this.stack, `${STACK_NAME}-nat`, {
            allocationId: eip.attrAllocationId,
            subnetId: this.subnets.public[0].ref
        });
        nat.addDependsOn(this.subnets.public[0]);

        return nat;
    }

    private createPublicRouteTable(vpc: CfnVPC, igw: CfnInternetGateway, gatewayAtt: CfnVPCGatewayAttachment) {
        // route table for public subnet
        const publicRouteTable = new CfnRouteTable(this.stack, `${STACK_NAME}-rt-public`, {
            vpcId: vpc.ref
        });

        const route = new CfnRoute(this.stack, `${STACK_NAME}-route-public`, {
            routeTableId: publicRouteTable.ref,
            destinationCidrBlock: "0.0.0.0/0",
            gatewayId: igw.ref
        });
        route.addDependsOn(igw);
        route.addDependsOn(gatewayAtt);

        // associate route table to subnet
        this.subnets.public.forEach((subnet, index) => {
            new CfnSubnetRouteTableAssociation(this.stack, `${STACK_NAME}-rt-ass-public${index+1}`, {
                routeTableId: publicRouteTable.ref,
                subnetId: subnet.ref
            });
        });
    }

    private createPrivateRouteTable(vpc: CfnVPC, nat: CfnNatGateway) {
        const privateRouteTable = new CfnRouteTable(this.stack, `${STACK_NAME}-rt-private`, {
            vpcId: vpc.ref
        });

        const route = new CfnRoute(this.stack, `${STACK_NAME}-route-private`, {
            routeTableId: privateRouteTable.ref,
            destinationCidrBlock: "0.0.0.0/0",
            natGatewayId: nat.ref
        });
        route.addDependsOn(nat);

        // associate route table to subnet
        this.subnets.private.forEach((subnet, index) => {
            new CfnSubnetRouteTableAssociation(this.stack, `${STACK_NAME}-rt-ass-private${index+1}`, {
                routeTableId: privateRouteTable.ref,
                subnetId: subnet.ref
            });
        });
    }
}