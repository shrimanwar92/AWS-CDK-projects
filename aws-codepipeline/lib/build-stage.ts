import {Stack, StackProps} from "aws-cdk-lib";
import {Artifact, StageOptions} from "aws-cdk-lib/aws-codepipeline";
import {CodeBuildAction} from "aws-cdk-lib/aws-codepipeline-actions";
import {ManagedPolicy} from "aws-cdk-lib/aws-iam";
import {BuildSpec, LinuxBuildImage, PipelineProject} from "aws-cdk-lib/aws-codebuild";
import {STACK_NAME, REPO_NAME} from "./utils";
import {Repository} from "aws-cdk-lib/aws-ecr";

interface BuildStageProps extends StackProps {
    ecrRepository: Repository
}

export default class BuildStage {
    private readonly stack: Stack;
    private readonly props: BuildStageProps;

    constructor(stack: Stack, props: BuildStageProps) {
        this.stack = stack;
        this.props = props;
    }

    create(input: Artifact, output: Artifact): StageOptions {
        const project = this.project;
        this.props.ecrRepository.grantPullPush(project.grantPrincipal);

        const action = new CodeBuildAction({
            actionName: "ImageBuildAction",
            input: input,
            project: project,
            outputs: [output]
        });

        return {
            stageName: 'Build',
            actions: [action]
        };
    }

    private get project() {
        const codeBuildProject = new PipelineProject(this.stack, `${STACK_NAME}-codebuild-project`, {
            projectName: `${STACK_NAME}-codebuild-project`,
            environment: {
                buildImage: LinuxBuildImage.AMAZON_LINUX_2_3,
                privileged: true,
            },
            environmentVariables: {
                ACCOUNT_ID: { value: this.stack.account },
                ACCOUNT_REGION: { value: this.stack.region },
                ECR_REPO_URL: { value: this.props.ecrRepository.repositoryUri },
                REPO_NAME: { value: REPO_NAME }
            },
            buildSpec: BuildSpec.fromObject({
                version: "0.2",
                phases: {
                    pre_build: {
                        commands: [
                            //'echo login to DockerHub',
                            //'docker login -u $DOCKER_USER_NAME -p $DOCKER_USER_PASSWORD',
                            'echo login to AWS ECR',
                            'echo $ECR_REPO',
                            'echo $ACCOUNT_ID.dkr.ecr.$ACCOUNT_REGION.amazonaws.com',
                            '(aws ecr get-login-password --region $ACCOUNT_REGION | docker login --username AWS --password-stdin $ACCOUNT_ID.dkr.ecr.$ACCOUNT_REGION.amazonaws.com)',
                            'COMMIT_HASH=$(echo $CODEBUILD_RESOLVED_SOURCE_VERSION | cut -c 1-7)',
                            'IMAGE_TAG=${COMMIT_HASH:=latest}',
                            `sed -i 's/ECR_REPO_URL/$ECR_REPO_URL/g;' docker-compose.yml`
                        ]
                    },
                    build: {
                        commands: [
                            'echo Build started on `date`',
                            'echo Building the Docker image...',
                            'docker-compose build',
                            'echo Build completed on `date`'
                        ]
                    },
                    post_build: {
                        commands: [
                            'echo Build completed on `date`',
                            'echo Pushing the Docker image...',
                            'docker-compose push',
                            //'printf \'{"ImageURI":"%s"}\' $ECR_REPO:latest > imageDetail.json',
                            'printf \'[{"name":"web","imageUri":"%s"}]\' $ECR_REPO_URL:latest > imagedefinitions.json',
                            'echo Pushing Docker Image completed on `date`'
                        ]
                    }
                },
                artifacts: {
                    files: [
                        //'imageDetail.json',
                        'imagedefinitions.json'
                    ]
                }
            }),
            //cache: Cache.local(LocalCacheMode.DOCKER_LAYER, LocalCacheMode.CUSTOM),
        });

        codeBuildProject.role?.addManagedPolicy(
            ManagedPolicy.fromAwsManagedPolicyName('AmazonEC2ContainerRegistryPowerUser')
        );

        return codeBuildProject;
    }
}