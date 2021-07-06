# NimbusODataServer AWS cloud deployment project

This is a deployment project for NimbusODataServer api.

## Useful commands

 * `npm run build`   compile typescript to js. Run this cmd when you make any changes to .ts file.
 * `cdk deploy`      deploy this stack to your default AWS account/region. This deploys all the stack present.
 * `cdk deploy <stack-id>`  deploys a specific stack.
 * `cdk diff`        compare deployed stack with current state
 * `cdk synth`       emits the synthesized CloudFormation template
 * `npm run build-prod` compiles typescript to js and emits the synthesized CloudFormation template in a single command for prod env.
 * `npm run deploy-dev` deploys DevStack.
 * `cdk destroy "*"` deletes all the stacks at once.
 * `cdk destroy <stack-id>` deletes a specific stack.
    Example: `cdk deploy DevStack`.
 
## NimbusODataServer deployment architecture
The following confluence link contains the detailed steps to execute the deployment steps and the architecture diagram.
https://confluence.tibco.com/pages/viewpage.action?pageId=200343673
