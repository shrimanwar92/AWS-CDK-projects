export const STACK_NAME = "torX";
export const AVAILABILITY_ZONES = ["us-east-1a", "us-east-1b"];
export const CONTAINER = {
    PORT: 80,
    NAME: "container"
};
export const REPO_NAME = '1xxx';
export const AUTOSCALING = {
    UP_SCALING_TIME: {hour: "12", min: "0"}, // the time is in UTC
    DOWN_SCALING_TIME: {hour: "01", min: "0"} // the time is in UTC
};
export const APPLICATION_DOCKER_IMAGE_PATH = "./../../source/node-app";
export const VPC_CIDR_BLOCK = "10.0.0.0/16";
