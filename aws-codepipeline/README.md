## AWS Codepipeline
This project constructs a codepipeline that fetches code from github, builds the project and
deploys the code to aws fargarte as ECS container service.

<!-- ##Use local tools
###Initialize project: `npx aws-cdk init --language typescript`

###Build:	`npm run build`

###Run CDK: `npx aws-cdk ...` -->

## Commands to deploy the stack
### Deploying pipeline
###`1. npx cdk synth AwsCodepipelineStack --context githubToken=<github-oauth-token> --context step=build`
###`2. npx cdk deploy AwsCodepipelineStack --context githubToken=<github-oauth-token> --context step=build`
###`3. npx cdk synth AwsCodepipelineStack --context githubToken=<github-oauth-token> --context step=deploy`
###`4. npx cdk deploy AwsCodepipelineStack --context githubToken=<github-oauth-token> --context step=deploy`

### Deleting pipeline
###`npx cdk destroy AwsCodepipelineStack --context githubToken=<github-oauth-token> --context step=deploy`