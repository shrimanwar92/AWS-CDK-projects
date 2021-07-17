import {Stack} from '@aws-cdk/core';
import {
    CfnVPC,
    CfnInternetGateway, CfnVPCGatewayAttachment,
    CfnNatGateway,
    CfnEIP,
    CfnRouteTable, CfnRoute, CfnSubnet, CfnSubnetRouteTableAssociation, IVpc
} from "@aws-cdk/aws-ec2";
import {STACK_NAME, AVAILABILITY_ZONES} from "./utils";

type Subnets = {
    public: CfnSubnet[],
    private: CfnSubnet[]
}

export default class VPC {
    readonly stack: Stack;
    cfnVpc: CfnVPC;
    vpc: IVpc;
    subnets: Subnets;
    internetGateway: CfnInternetGateway;
    natGateway: CfnNatGateway;
    gatewayAttachment: CfnVPCGatewayAttachment;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    create(): VPC {
        this.cfnVpc = new CfnVPC(this.stack, `${STACK_NAME}-vpc`, {
            cidrBlock: "10.0.0.0/16",
            enableDnsSupport: true,
            enableDnsHostnames: true,
            tags: [{key: "VpcName", value: `${STACK_NAME}-vpc`}]
        });

        return this;
    }

    createSubnets(): VPC {
        const publicSubnet1 = new CfnSubnet(this.stack, `${STACK_NAME}-public-subnet1`, {
            vpcId: this.cfnVpc.ref,
            availabilityZone: AVAILABILITY_ZONES[0],
            cidrBlock: '10.0.1.0/24'
        });
        const publicSubnet2 = new CfnSubnet(this.stack, `${STACK_NAME}-public-subnet2`, {
            vpcId: this.cfnVpc.ref,
            availabilityZone: AVAILABILITY_ZONES[1],
            cidrBlock: '10.0.2.0/24'
        });
        const privateSubnet1 = new CfnSubnet(this.stack, `${STACK_NAME}-private-subnet1`, {
            vpcId: this.cfnVpc.ref,
            availabilityZone: AVAILABILITY_ZONES[0],
            cidrBlock: '10.0.3.0/24'
        });
        const privateSubnet2 = new CfnSubnet(this.stack, `${STACK_NAME}-private-subnet2`, {
            vpcId: this.cfnVpc.ref,
            availabilityZone: AVAILABILITY_ZONES[1],
            cidrBlock: '10.0.4.0/24'
        });

        publicSubnet1.addDependsOn(this.cfnVpc);
        privateSubnet1.addDependsOn(this.cfnVpc);
        publicSubnet2.addDependsOn(this.cfnVpc);
        privateSubnet2.addDependsOn(this.cfnVpc);

        this.subnets = {
            public: [publicSubnet1, publicSubnet2],
            private: [privateSubnet1, privateSubnet2]
        };

        return this;
    }

    createInternetGateway(): VPC {
        this.internetGateway = new CfnInternetGateway(this.stack, `${STACK_NAME}-igw`, {
            tags: [{key: "IGW", value: `${STACK_NAME}-igw`}]
        });
        this.gatewayAttachment = new CfnVPCGatewayAttachment(this.stack, `${STACK_NAME}-igw-attachment`, {
            vpcId: this.cfnVpc.ref,
            internetGatewayId: this.internetGateway.ref
        });

        this.internetGateway.addDependsOn(this.subnets.public[0]);
        this.internetGateway.addDependsOn(this.subnets.public[1]);
        this.gatewayAttachment.addDependsOn(this.internetGateway);
        this.gatewayAttachment.addDependsOn(this.cfnVpc);

        return this;
    }

    createNatGateway(): VPC {
        const eip = new CfnEIP(this.stack, `${STACK_NAME}-eip`, {
            domain: "vpc"
        });
        eip.addDependsOn(this.internetGateway);
        eip.addDependsOn(this.gatewayAttachment);

        this.natGateway = new CfnNatGateway(this.stack, `${STACK_NAME}-nat`, {
            allocationId: eip.attrAllocationId,
            subnetId: this.subnets.public[0].ref
        });
        this.natGateway.addDependsOn(this.subnets.public[0]);

        return this;
    }

    createRouteTable() {
        this.createPublicRouteTable();
        this.createPrivateRouteTable();
        return this;
    }

    private createPublicRouteTable() {
        // route table for public subnet
        const publicRouteTable = new CfnRouteTable(this.stack, `${STACK_NAME}-rt-public`, {
            vpcId: this.cfnVpc.ref
        });

        const route = new CfnRoute(this.stack, `${STACK_NAME}-route-public`, {
            routeTableId: publicRouteTable.ref,
            destinationCidrBlock: "0.0.0.0/0",
            gatewayId: this.internetGateway.ref
        });
        route.addDependsOn(this.internetGateway);
        route.addDependsOn(this.gatewayAttachment);

        // associate route table to subnet
        this.subnets.public.forEach((subnet, index) => {
            new CfnSubnetRouteTableAssociation(this.stack, `${STACK_NAME}-rt-ass-public${index+1}`, {
                routeTableId: publicRouteTable.ref,
                subnetId: subnet.ref
            });
        });
    }

    private createPrivateRouteTable() {
        const privateRouteTable = new CfnRouteTable(this.stack, `${STACK_NAME}-rt-private`, {
            vpcId: this.cfnVpc.ref
        });

        const route = new CfnRoute(this.stack, `${STACK_NAME}-route-private`, {
            routeTableId: privateRouteTable.ref,
            destinationCidrBlock: "0.0.0.0/0",
            natGatewayId: this.natGateway.ref
        });
        route.addDependsOn(this.natGateway);

        // associate route table to subnet
        this.subnets.private.forEach((subnet, index) => {
            new CfnSubnetRouteTableAssociation(this.stack, `${STACK_NAME}-rt-ass-private${index+1}`, {
                routeTableId: privateRouteTable.ref,
                subnetId: subnet.ref
            });
        });
    }
}