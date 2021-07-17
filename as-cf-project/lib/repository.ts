import {Stack} from "@aws-cdk/core";
import {IRepository, Repository} from "@aws-cdk/aws-ecr";

export default class ECRRepository {
    readonly stack: Stack;
    repository: IRepository;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    fetch(name: string): IRepository {
         return Repository.fromRepositoryName(this.stack, `import-repository`, name);
    }
}