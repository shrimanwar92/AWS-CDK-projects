import {CfnOutput, Construct, ScopedAws, Stack, StackProps} from "@aws-cdk/core";
import {GatewayVpcEndpointAwsService, InterfaceVpcEndpointAwsService, IVpc, SecurityGroup, SubnetType, Vpc} from "@aws-cdk/aws-ec2";
import {ApplicationLoadBalancer, ContentType, ListenerAction, ApplicationListener} from "@aws-cdk/aws-elasticloadbalancingv2";

export class DevStack extends Stack {
    vpc: IVpc;
    loadbalancer: ApplicationLoadBalancer;
    securityGroup: SecurityGroup;
    listener: ApplicationListener;
    private STACK_NAME: string;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);

        this.STACK_NAME = new ScopedAws(this).stackName;

        this.vpc = new Vpc(this, `dev-VPC`, {
            subnetConfiguration: [{
                cidrMask: 24,
                name: 'Public',
                subnetType: SubnetType.PUBLIC
            },{
                cidrMask: 24,
                name: 'Application',
                subnetType: SubnetType.PRIVATE
            }]
        });

        this.securityGroup = new SecurityGroup(this, `dev-security-group`, {
            securityGroupName: `${this.STACK_NAME}-sg`,
            vpc: this.vpc,
            allowAllOutbound: true,
            description: "Security group for dev stack"
        });

        this.vpc.addInterfaceEndpoint('EcrDockerEndpoint', {
            service: InterfaceVpcEndpointAwsService.ECR_DOCKER,
            securityGroups: [this.securityGroup],
            privateDnsEnabled: true
        });

        this.vpc.addInterfaceEndpoint('ECREndpoint', {
            service: InterfaceVpcEndpointAwsService.ECR,
            securityGroups: [this.securityGroup],
            privateDnsEnabled: true
        });

        /*
        Docker uses s3 gateway to pull an image from S3(Don't know why but it does) for that purpose we need s3 gateway endpoint.
        Also Docker will try to write logs to cloudwatch so the cloudwatch endpoints are needed.
        If we don't provide cloudwatch endpoints, container will throw below exception
        "DockerTimeoutError: Could not transition to started; timed out after waiting 3m0s",
        even though it successfully pulls the image from ECR. This is not documented in AWS docs.
         */

        this.vpc.addGatewayEndpoint('S3GatewayEndpoint', {
            service: GatewayVpcEndpointAwsService.S3
        });

        this.vpc.addInterfaceEndpoint('CloudwatchEndpoint', {
            service: InterfaceVpcEndpointAwsService.CLOUDWATCH,
            securityGroups: [this.securityGroup],
            privateDnsEnabled: true
        });

        this.vpc.addInterfaceEndpoint('CloudwatchEventsEndpoint', {
            service: InterfaceVpcEndpointAwsService.CLOUDWATCH_EVENTS,
            securityGroups: [this.securityGroup],
            privateDnsEnabled: true
        });

        this.vpc.addInterfaceEndpoint('CloudwatchLogsEndpoint', {
            service: InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS,
            securityGroups: [this.securityGroup],
            privateDnsEnabled: true
        });

        // Create the load balancer in a VPC. 'internetFacing' is 'false'
        // by default, which creates an internal load balancer.
        this.loadbalancer = new ApplicationLoadBalancer(this, `dev-loadbalancer`, {
            loadBalancerName: `${this.STACK_NAME}-lb`,
            vpc: this.vpc,
            internetFacing: true,
            securityGroup: this.securityGroup
        });
        this.listener = this.loadbalancer.addListener(`dev-listener`, {port: 80, open: true});
        this.listener.addAction(`dev-fixed-action`, {
            action: ListenerAction.fixedResponse(200, {
                contentType: ContentType.TEXT_PLAIN,
                messageBody: 'OK',
            })
        });

        new CfnOutput(this, 'VpcId', {
            value: this.vpc.vpcId,
            description: 'vpc from dev stack'
        });

        new CfnOutput(this, 'AZS', {
            value: this.vpc.availabilityZones.toString(),
            description: 'azs from dev stack'
        });

        new CfnOutput(this, 'LoadBalancerArn', {
            value: this.loadbalancer.loadBalancerArn,
            description: 'load balancer arn from dev stack'
        });

        new CfnOutput(this, 'LoadBalancerDNS', {
            value: this.loadbalancer.loadBalancerDnsName,
            description: 'load balancer DNS from dev stack'
        });

        new CfnOutput(this, 'LoadBalancerSecurityGroupId', {
            value: this.securityGroup.securityGroupId,
            description: 'load balancer security group id from dev stack'
        });

        new CfnOutput(this, 'VPC Private Subnets', {
            value: this.vpc.privateSubnets.map(subnet => subnet.subnetId).toString()
        });
    }
}