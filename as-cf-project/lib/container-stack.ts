import {Construct, Stack, StackProps} from "@aws-cdk/core";
import Container, {ContainerProps} from "./container";

type ContainerStackProps = ContainerProps & StackProps;

export class ContainerStack extends Stack {
    container: Container;

    constructor(scope: Construct, id: string, props: ContainerStackProps) {
        super(scope, id, props);

        this.container = new Container(this, {
            vpc: props.vpc,
            repository: props.repository,
            loadBalancerSecurityGroup: props.loadBalancerSecurityGroup,
            listener: props.listener
        }).createFromRepository();
    }
}