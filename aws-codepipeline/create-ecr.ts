// This script creates a ECR repository with specific name if it doesn't exist,
// and does nothing if this repository already exists,
// so it is used in a full dev deployment npm script

// Use the global AWS CLI config defined in the user profile
import {execSync} from "child_process";
import { ECRClient, DescribeRepositoriesCommand, CreateRepositoryCommand, ListImagesCommand } from "@aws-sdk/client-ecr";
import {REPO_NAME, PROJECT_PATH} from "./lib/utils";

process.env.AWS_SDK_LOAD_CONFIG = "true";

const region = "us-east-2";

console.log('Using region:', region);
console.log('Using repository name:', REPO_NAME);

const client = new ECRClient({});

async function start() {
    try {
        const command = new DescribeRepositoriesCommand({repositoryNames: [REPO_NAME]});
        const data = await client.send(command);

        console.log(`Repository "${REPO_NAME}" found.`);

        const repo = data.repositories && data.repositories.find(repo => repo.repositoryName === REPO_NAME);
        const imageExists = await checkIfImageExists();
        if(!imageExists) {
            console.log("Image not found. Pushing local image.");
            repo && repo.repositoryUri && pushImage(repo.repositoryUri)
        }
    } catch (err) {
        console.log(`Repository "${REPO_NAME}" not found, creating repository...`);
        const repository = await createRepository();
        repository && repository.repositoryUri && pushImage(repository.repositoryUri);
    }
}

async function checkIfImageExists() {
    const command = new ListImagesCommand({repositoryName: REPO_NAME});
    const data = await client.send(command);
    return data.imageIds && data.imageIds.length > 0;
}

async function createRepository() {
    const command = new CreateRepositoryCommand({repositoryName: REPO_NAME});
    const data = await client.send(command);
    return data.repository;
}

function pushImage(url: string) {
    process.chdir(PROJECT_PATH);
    execSync(`aws ecr get-login-password --region ${region} | docker login --username AWS --password-stdin ${url}`, {stdio: 'inherit'});
    execSync(`docker build -f node.dockerfile -t ${REPO_NAME} .`, {stdio: 'inherit'});
    execSync(`docker tag ${REPO_NAME}:latest ${url}:latest`, {stdio: 'inherit'});
    execSync(`docker push ${url}:latest`, {stdio: 'inherit'});
}

start();