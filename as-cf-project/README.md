# AWS CDK automated deployment thats uses vpc - ELB - Fargate - ECR - containers

The project deploys a node-web-app to ECS fargate service.

*   A VPC(CfnVpc) with 2 public and 2 private subnets(CfnSubnets).
*   A internet gateway(CfnInternetGateway) attached to vpc using gateway attachment(CfnVPCGatewayAttachment).
*   A EIP(CfnEIP) attached to NatGateway(CfnNatGateway). NatGateway are created for both the public subnets.
*   A route table(CfnRouteTable) for all the subnets. Public route table association uses internet gateway and private route table association uses nat gateway.
*   A loadbalancer with its own security group that allows traffic on port 80. A listener that will listen on port 80. A security group that allows incoming traffic on port 80.
*   A fargate service that runs a container which hosts a node-web-app. 
*   A target group for fargate service, with health check configured. And adding this target group to the listener rules to direct traffic to fargate service.
*	Scheduled application auto scaling is enabled for fargate service that upscales 3 fargate tasks at 12:00 UTC and downscales to 1 task at 1:00 UTC. Application load balancer 
    splits the traffic 1/3 to every task when upscaled because it follows round robin.

## Useful commands

 * `npm run build`   compile typescript to js
 * `cdk synth`       emits the synthesized CloudFormation template
 * `cdk deploy DeploymentStack --parameters repositoryName=<path to your ecr repository which already exists>` deploys deployment stack
 * `cdk deploy ContainerStack` deploys container to ECS


## Screenshots

![alt text](https://github.com/shrimanwar92/AWS-CDK-projects/blob/master/as-cf-project/screenshots/cloudformation-stacks.PNG?raw=true)


![alt text](https://github.com/shrimanwar92/AWS-CDK-projects/blob/master/as-cf-project/screenshots/ecr-repo-image.PNG?raw=true)


![alt text](https://github.com/shrimanwar92/AWS-CDK-projects/blob/master/as-cf-project/screenshots/target-group.PNG?raw=true)


![alt text](https://github.com/shrimanwar92/AWS-CDK-projects/blob/master/as-cf-project/screenshots/fargate-task.PNG?raw=true)


![alt text](https://github.com/shrimanwar92/AWS-CDK-projects/blob/master/as-cf-project/screenshots/running-container.PNG?raw=true)


![alt text](https://github.com/shrimanwar92/AWS-CDK-projects/blob/master/as-cf-project/screenshots/output.PNG?raw=true)


![alt text](https://raw.githubusercontent.com/shrimanwar92/AWS-CDK-projects/master/as-cf-project/screenshots/autoscaling.png)
