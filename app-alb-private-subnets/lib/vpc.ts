import {Stack} from '@aws-cdk/core';
import {
    CfnVPC,
    CfnInternetGateway, CfnVPCGatewayAttachment,
    CfnNatGateway,
    CfnEIP,
    CfnRouteTable, CfnRoute, CfnSubnet, CfnSubnetRouteTableAssociation
} from "@aws-cdk/aws-ec2";
import {STACK_NAME, AVAILABILITY_ZONES} from "./utils";

type SubnetGroup = {
    public: CfnSubnet[],
    private: CfnSubnet[]
}

type InternetGatewayProps = {
    internetGateway: CfnInternetGateway,
    gatewayAttachment: CfnVPCGatewayAttachment
}

export default class VPC {
    stack: Stack;
    vpc: CfnVPC;
    subnets: SubnetGroup;
    gatewayProps: InternetGatewayProps;
    nats: CfnNatGateway[];

    constructor(stack: Stack) {
        this.stack = stack;

        this.vpc = this.createVpc();
        this.subnets = this.createSubnets();
        this.gatewayProps = this.createInternetGateway();
        this.nats = this.createNatGateway();
        this.createRouteTable();
    }

    private createVpc(): CfnVPC {
        return new CfnVPC(this.stack, `${STACK_NAME}-vpc`, {
            cidrBlock: "10.0.0.0/16",
            enableDnsSupport: true,
            enableDnsHostnames: true,
            tags: [{key: "VpcName", value: `${STACK_NAME}-vpc`}]
        });
    }

    private createSubnets(): SubnetGroup {
        const publicSubnet1 = new CfnSubnet(this.stack, `${STACK_NAME}-public-subnet1`, {
            vpcId: this.vpc.ref,
            availabilityZone: AVAILABILITY_ZONES[0],
            cidrBlock: '10.0.1.0/24'
        });
        const publicSubnet2 = new CfnSubnet(this.stack, `${STACK_NAME}-public-subnet2`, {
            vpcId: this.vpc.ref,
            availabilityZone: AVAILABILITY_ZONES[1],
            cidrBlock: '10.0.2.0/24'
        });
        const privateSubnet1 = new CfnSubnet(this.stack, `${STACK_NAME}-private-subnet1`, {
            vpcId: this.vpc.ref,
            availabilityZone: AVAILABILITY_ZONES[0],
            cidrBlock: '10.0.3.0/24'
        });
        const privateSubnet2 = new CfnSubnet(this.stack, `${STACK_NAME}-private-subnet2`, {
            vpcId: this.vpc.ref,
            availabilityZone: AVAILABILITY_ZONES[1],
            cidrBlock: '10.0.4.0/24'
        });

        publicSubnet1.addDependsOn(this.vpc);
        privateSubnet1.addDependsOn(this.vpc);
        publicSubnet2.addDependsOn(this.vpc);
        privateSubnet2.addDependsOn(this.vpc);

        return {
            public: [publicSubnet1, publicSubnet2],
            private: [privateSubnet1, privateSubnet2]
        };
    }

    private createInternetGateway(): InternetGatewayProps {
        const internetGateway = new CfnInternetGateway(this.stack, `${STACK_NAME}-igw`, {
            tags: [{key: "IGW", value: `${STACK_NAME}-igw`}]
        });
        const gatewayAttachment = new CfnVPCGatewayAttachment(this.stack, `${STACK_NAME}-igw-attachment`, {
            vpcId: this.vpc.ref,
            internetGatewayId: internetGateway.ref
        });

        internetGateway.addDependsOn(this.subnets.public[0]);
        internetGateway.addDependsOn(this.subnets.public[1]);
        gatewayAttachment.addDependsOn(internetGateway);
        gatewayAttachment.addDependsOn(this.vpc);

        return {
            internetGateway,
            gatewayAttachment
        };
    }

    private createNatGateway(): CfnNatGateway[] {
        return this.subnets.public.map((subnet, index) => {
            const eip = new CfnEIP(this.stack, `${STACK_NAME}-eip${index+1}`, {
                domain: "vpc"
            });
            eip.addDependsOn(this.gatewayProps.internetGateway);
            eip.addDependsOn(this.gatewayProps.gatewayAttachment);

            const natGateway = new CfnNatGateway(this.stack, `${STACK_NAME}-nat${index+1}`, {
                allocationId: eip.attrAllocationId,
                subnetId: subnet.ref
            });
            natGateway.addDependsOn(subnet);

            return natGateway;
        });
    }

    private createRouteTable() {
        this.createPublicRouteTable();
        this.createPrivateRouteTable();
    }

    private createPublicRouteTable() {
        // route table for public subnet
        const publicRouteTable = new CfnRouteTable(this.stack, `${STACK_NAME}-rt-public`, {
            vpcId: this.vpc.ref
        });

        const route = new CfnRoute(this.stack, `${STACK_NAME}-route-public`, {
            routeTableId: publicRouteTable.ref,
            destinationCidrBlock: "0.0.0.0/0",
            gatewayId: this.gatewayProps.internetGateway.ref
        });
        route.addDependsOn(this.gatewayProps.internetGateway);
        route.addDependsOn(this.gatewayProps.gatewayAttachment);

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
            vpcId: this.vpc.ref
        });

        const route = new CfnRoute(this.stack, `${STACK_NAME}-route-private`, {
            routeTableId: privateRouteTable.ref,
            destinationCidrBlock: "0.0.0.0/0",
            natGatewayId: this.nats[0].ref
        });
        route.addDependsOn(this.nats[0]);

        // associate route table to subnet
        this.subnets.private.forEach((subnet, index) => {
            new CfnSubnetRouteTableAssociation(this.stack, `${STACK_NAME}-rt-ass-private${index+1}`, {
                routeTableId: privateRouteTable.ref,
                subnetId: subnet.ref
            });
        });
    }
}