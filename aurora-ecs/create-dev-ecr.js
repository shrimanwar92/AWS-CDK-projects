// This script creates a ECR repository with specific name if it doesn't exist,
// and does nothing if this repository already exists,
// so it is used in a full dev deployment npm script

// Use the global AWS CLI config defined in the user profile
process.env.AWS_SDK_LOAD_CONFIG = true;

const {DEFAULT_REPOSITORY_NAME} = require('./lib/utils');
const AWS = require('aws-sdk');
const {execSync} = require('child_process');

console.log('Usage: node create-dev-ecr.js <optional repo name>');

const region = AWS.config.region;
let repoName = DEFAULT_REPOSITORY_NAME;
if (process.argv.length > 2) {
    repoName = process.argv[2];
}
console.log('Using region:', region);
console.log('Using repository name:', repoName);

const ecr = new AWS.ECR();

const params = {
    repositoryNames: [
        repoName
    ]
};
ecr.describeRepositories(params, function (err, data) {
    if (err && err.code !== 'RepositoryNotFoundException') {
        throw err;
    } else {
        if (data && data.repositories.length) {
            console.log(`Repository "${repoName}" found, exiting`);
        } else {
            console.log(`Repository "${repoName}" not found, deploying the Repository stack...`);
            execSync(`cdk deploy Repository --parameters repositoryName=${repoName}`);
        }
    }
});