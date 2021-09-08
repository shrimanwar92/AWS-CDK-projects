import {Construct, Stack, StackProps} from "@aws-cdk/core";
import Container from "./container";
import {Role, ServicePrincipal} from "@aws-cdk/aws-iam";
import {STACK_NAME} from "./utils";
import {IRepository} from "@aws-cdk/aws-ecr";
import {Cluster, ICluster} from "@aws-cdk/aws-ecs";
import {ISecurityGroup, IVpc} from "@aws-cdk/aws-ec2";
import JenkinsContainer from './jenkins';
import {IApplicationListener, IApplicationLoadBalancer} from "@aws-cdk/aws-elasticloadbalancingv2";

export interface ContainerStackProps {
    vpc: IVpc,
    repository: IRepository,
    loadBalancerSecurityGroup: ISecurityGroup,
    loadBalancer: IApplicationLoadBalancer,
}

type Props = ContainerStackProps & StackProps;

export class ContainerStack extends Stack {

    constructor(scope: Construct, id: string, props: Props) {
        super(scope, id, props);

        const taskRole = this.createTaskRole(props.repository);
        const cluster = this.createCluster(props.vpc);

        new Container(this, {
            vpc: props.vpc,
            repository: props.repository,
            taskRole,
            cluster,
            loadBalancerSecurityGroup: props.loadBalancerSecurityGroup,
            loadBalancer: props.loadBalancer
        }).addAppContainer();

        new JenkinsContainer(this, {
            vpc: props.vpc,
            taskRole,
            cluster,
            loadBalancer: props.loadBalancer,
            loadBalancerSecurityGroup: props.loadBalancerSecurityGroup,
        }).addContainer();
    }

    private createTaskRole(repo: IRepository) {
        const taskRole =  new Role(this, `task-role`, {
            roleName: `${STACK_NAME}-task-role`,
            assumedBy: new ServicePrincipal("ecs-tasks.amazonaws.com"),
        });
        repo.grantPull(taskRole);
        return taskRole;
    }

    private createCluster(vpc: IVpc): ICluster {
        return new Cluster(this, `cluster`, {vpc, clusterName: `${STACK_NAME}-cluster` });
    }
}