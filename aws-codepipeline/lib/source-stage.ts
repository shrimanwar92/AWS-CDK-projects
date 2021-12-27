import {GitHubSourceAction, GitHubTrigger} from "aws-cdk-lib/aws-codepipeline-actions";
import {SecretValue, Stack, StackProps} from 'aws-cdk-lib';
import {Artifact, StageOptions} from "aws-cdk-lib/aws-codepipeline";
import {GITHUB} from "./utils";

interface SourceStageProps extends StackProps {
    githubToken: string
}

export default class SourceStage {
    private readonly stack: Stack;
    private readonly props: SourceStageProps;

    constructor(stack: Stack, props: SourceStageProps) {
        this.stack = stack;
        this.props = props;
    }

    create(output: Artifact): StageOptions {
        const action = new GitHubSourceAction({
            actionName: 'Github',
            owner: GITHUB.owner,
            repo: GITHUB.repo,
            oauthToken: SecretValue.plainText(this.props.githubToken),
            output: output,
            branch: 'master', // default: 'master'
            trigger: GitHubTrigger.WEBHOOK
        });

        return {
            stageName: 'Source',
            actions: [action]
        };
    }
}