import {Construct, Stack, StackProps} from "@aws-cdk/core";
import Container, {ContainerProps} from "./container";

type ContainerStackProps = ContainerProps & StackProps;

export class ContainerStack extends Stack {

    constructor(scope: Construct, id: string, props: ContainerStackProps) {
        super(scope, id, props);

        const containerService = new Container(this, {
            vpc: props.vpc,
            repository: props.repository,
            loadBalancerSecurityGroup: props.loadBalancerSecurityGroup,
            listener: props.listener
        });

        containerService.createCluster(); // create cluster
        containerService.createTaskRole(); // create task role
        containerService.createTaskDefinition(); // create task definition
        containerService.addElasticSearch(); // add elastic search
        containerService.addContainerApplication(); // add container application
        containerService.startFargateService(); // start fargate tasks
        containerService.setupAutoScaling(); // setup auto-scaling (currently scheduled)
    }
}