import {CfnOutput, Stack} from "@aws-cdk/core";
import {IRepository, Repository} from "@aws-cdk/aws-ecr";
import {REPO_NAME} from "./utils";

export default class ECRRepository {
    readonly stack: Stack;
    repository: IRepository;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    create(): IRepository {
        return new Repository(this.stack, `create-repository`, { repositoryName: REPO_NAME });
    }

    fetch(name: string): IRepository {
         return Repository.fromRepositoryName(this.stack, `import-repository`, name);
    }
}