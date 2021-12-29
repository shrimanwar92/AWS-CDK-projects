export const STACK_NAME = "cpl";
export const GITHUB = {
    owner: "shrimanwar92",
    repo: "node-app-aws-codepipeline"
};
export const REPO_NAME = "web";
// This is used to deploy a docker image initially so that when the codepipeline starts it finds the image.
// Otherwise deployment will fail as Fargate will not be able to find the image when service starts
export const PROJECT_PATH = "C:\\Users\\nshriman\\Videos\\node-app-aws-codepipeline";



//export const DEPLOYMENT_GRP_NAME = "deployment-group";