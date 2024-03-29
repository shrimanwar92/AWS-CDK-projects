const {REPO_NAME, APPLICATION_DOCKER_IMAGE_PATH} = require('./lib/utils');
const { spawn, execSync } = require('child_process');
const AWS = require('aws-sdk');
process.env.AWS_SDK_LOAD_CONFIG = true;

const repositoryName =  process.argv[2] || REPO_NAME;
const ecr = new AWS.ECR();

async function main() {
    try {
        //process.chdir("./../../source/node-app");
        //console.log(process.cwd());
        const repo = await getRepository();
        await loginToEcr(repo.repositoryUri);
        buildAndPushImage(repo.repositoryUri);
    } catch (err) {
        console.error(err);
        throw err;
    }
}


function buildAndPushImage(repoUri) {
    const tag = `node-web-app-${Date.now()}`;

    // change directory where dockerfile is present
    // execSync is used because each step is dependant on its previous step
    process.chdir(APPLICATION_DOCKER_IMAGE_PATH);
    // build
    execSync(`docker build -t ${tag} . --no-cache`, {stdio: 'inherit'});
    //tag
    execSync(`docker tag ${tag} ${repoUri}`, {stdio: 'inherit'});
    // push
    execSync(`docker push ${repoUri}`, {stdio: 'inherit'});
}

async function loginToEcr(repoUri) {
    console.log(`Login in ${repoUri}`);
    return new Promise((resolve, reject) => {
        const awsCmd = spawn("aws", ["ecr", "get-login-password"]);
        const dockerCmd = spawn('docker', ["login", "-u", "AWS", "--password-stdin", repoUri]);
        awsCmd.stdout.pipe(dockerCmd.stdin);

        dockerCmd.stdout.on('data', data => {
            const resp = data.toString().trim();
            console.log(resp);
            resolve(resp);
        });
        awsCmd.stderr.on('data', err => {
            reject(err.toString().trim());
        });
        dockerCmd.stderr.on('data', err => {
            reject(err.toString().trim());
        });
    });
}

async function getRepository() {
    let params = {
        repositoryNames: [repositoryName]
    };

    return new Promise((resolve, reject) => {
        ecr.describeRepositories(params, function(err, data) {
            if (err) {
                reject(err);
            } else {
                const repo = data.repositories[0];
                console.log(`Repository "${repo.repositoryName}" found.`);
                resolve(repo);
            }
        });
    });
}

main();