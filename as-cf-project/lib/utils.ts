export const STACK_NAME = "torX";
export const AVAILABILITY_ZONES = ["us-east-1a", "us-east-1b"];
export const CONTAINER = {
    PORT: 80,
    NAME: "container"
};
export const REPO_NAME = '1xxx';
export const AUTOSCALING = {
    UP_SCALING_TIME: {hour: "8", min: "0"},
    DOWN_SCALING_TIME: {hour: "20", min: "0"}
};
export const APPLICATION_DOCKER_IMAGE_PATH = "./../../source/node-app";
