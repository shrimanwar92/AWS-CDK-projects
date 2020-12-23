# AWS ALB with EC2 instance in private subnets with resources created with low-level constructs

We have used low-level cdk constructs to create CF resources.

This is a AWS CDK project that creates
*   A VPC(CfnVpc) with 2 public and 2 private subnets(CfnSubnets).
*   A internet gateway(CfnInternetGateway) attached to vpc using gateway attachment(CfnVPCGatewayAttachment).
*   A EIP(CfnEIP) attached to NatGateway(CfnNatGateway). NatGateway are created for both the public subnets.
*   A route table(CfnRouteTable) for all the subnets. Public route table association uses internet gateway and private route table association uses nat gateway.
*   A loadbalancer with its own security group that allows traffic on port 80. A listener that will listen on port 80. A security group that allows incoming traffic on port 80.
*   A EC2 instance that runs a Apache server with some static text. A security group that allows the traffic from loadbalancer to EC2 instance.
*   A target group for EC2 instance, with health check configured. And adding this target group to the listener rules to direct traffic to EC2 instance.

The `cdk.out/Infra.template.json` contains the generated cloudformation template.

## Useful commands

 * `cdk deploy Infra`   deploys Infra stack.
 * `npm run build`      compiles ts files and runs `cdk synth` to generate updated template.