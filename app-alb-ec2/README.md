# AWS ALB with EC2 instance in public subnets

This is a AWS CDK project that creates
*   A VPC with 2 public and 2 private subnets.
*   A loadbalancer with its own security group that allows traffic on port 80. A listener that will listen on port 80. A security group that allows incoming traffic on port 80.
*   A EC2 instance that runs a Apache server with some static text. A security group that allows the traffic from loadbalancer to EC2 instance.
*   A target group for EC2 instance, with health check configured. And adding this target group to the listener rules to direct traffic to EC2 instance.

The `cdk.out/Infra.template.json` contains the generated cloudformation template.

## Useful commands

 * `cdk deploy Infra`   deploys Infra stack.
 * `npm run build`      compiles ts files and runs `cdk synth` to generate updated template.