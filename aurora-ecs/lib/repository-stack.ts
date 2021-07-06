import {CfnOutput, CfnParameter, Construct, ScopedAws, Stack, StackProps} from "@aws-cdk/core";
import {IRepository, Repository} from "@aws-cdk/aws-ecr";

export class RepositoryStack extends Stack {
    repository: IRepository;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        // create repository
        const repositoryName = new CfnParameter(this, "repositoryName", {type: "String"}).valueAsString;

        this.repository = new Repository(this, `odata-repository`, { repositoryName: repositoryName });

        new CfnOutput(this, 'RepositoryUri', {
            value: this.repository.repositoryUri
        });
    }
}

/*  Part-2
    After running the "cdk deploy" command for deployment stack, you will see the outputs with names "RepositoryUri" and "RepositoryArn"
    grab the "RepositoryUri".
    1) Open the command prompt
    2) Type "aws ecr get-login --no-include-email" (without quotes)
    you will see output something similar to "docker login -u AWS -p <your_token_which_is_massive> -e none <your_aws_url>"
    3) Copy and paste this command in the cmd prompt and you will see the message "Login Succeeded".
    4) Run the docker push command
    Example:>
            docker build -t <tag-name> . OR docker build .. -f .\Dockerfile -t <tag-name> (works from the folder with Dockerfile)
            docker tag <tag-name> <RepositoryUri>
            docker push <RepositoryUri>
    5) If this command is successful you should be able to see the output with digest with "latest" tag.
*/