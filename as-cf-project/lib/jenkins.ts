import {
    ContainerImage,
    LogDrivers,
    ICluster, TaskDefinition, FargateService, FargateTaskDefinition
} from "@aws-cdk/aws-ecs";
import {Stack, RemovalPolicy, Duration} from "@aws-cdk/core";
import {JENKINS_CONTAINER} from "./utils";
import {ISecurityGroup, IVpc, Peer, Port, SecurityGroup, SubnetType} from "@aws-cdk/aws-ec2";
import {AccessPoint, FileSystem} from "@aws-cdk/aws-efs";
import {
    ApplicationTargetGroup,
    IApplicationLoadBalancer,
    ApplicationProtocol,
    ListenerAction, CfnListenerRule
} from "@aws-cdk/aws-elasticloadbalancingv2";
import {Role} from "@aws-cdk/aws-iam";

interface JenkinsProps {
    cluster: ICluster,
    vpc: IVpc,
    taskRole: Role,
    loadBalancer: IApplicationLoadBalancer,
    loadBalancerSecurityGroup: ISecurityGroup
}

/*export interface Jenkins {
    efs: FileSystem,
    jenkinsContainer: ContainerDefinition
}*/

export default class JenkinsContainer {
    readonly stack: Stack;
    readonly props: JenkinsProps;

    constructor(stack: Stack, props: JenkinsProps) {
        this.stack = stack;
        this.props = props;
    }

    private addEFSFileSystem(): {efs: FileSystem, accessPoint: AccessPoint} {
        const efs = new FileSystem(this.stack, 'JenkinsFileSystem', {
            vpc: this.props.vpc,
            removalPolicy: RemovalPolicy.DESTROY
        });
        const accessPoint = efs.addAccessPoint('JenkinsAccessPoint', {
            path: '/jenkins-home',
            posixUser: {
                uid: '1000',
                gid: '1000',
            },
            createAcl: {
                ownerGid: '1000',
                ownerUid: '1000',
                permissions: '755'
            }
        });

        return { efs, accessPoint };
    }

    private createTaskDefinition(): TaskDefinition {
        const taskDefinition = new FargateTaskDefinition(this.stack, 'jenkins-task-def', {
            family: 'jenkins-task-def',
            taskRole: this.props.taskRole,
            executionRole: this.props.taskRole,
            memoryLimitMiB: 1024,
            cpu: 512,
        });

        return taskDefinition;
    }

    addContainer() {
        const {efs, accessPoint} = this.addEFSFileSystem();
        const taskDef = this.createTaskDefinition();

        taskDef.addVolume({
            name: 'jenkins-home',
            efsVolumeConfiguration: {
                fileSystemId: efs.fileSystemId,
                transitEncryption: 'ENABLED',
                authorizationConfig: {
                    accessPointId: accessPoint.accessPointId,
                    iam: 'ENABLED'
                }
            }
        });

        const containerDefinition = taskDef.addContainer('jenkins', {
            image: ContainerImage.fromRegistry("jenkins/jenkins:lts"),
            logging: LogDrivers.awsLogs({streamPrefix: 'jenkins'}),
            portMappings: [{
                containerPort: JENKINS_CONTAINER.PORT,
                hostPort: JENKINS_CONTAINER.PORT
            }],
            containerName: JENKINS_CONTAINER.NAME
        });
        containerDefinition.addMountPoints({
            containerPath: '/var/jenkins_home',
            sourceVolume: 'jenkins-home',
            readOnly: false
        });

        const fargateService = this.startFargateService(taskDef);
        this.allowPermissions(fargateService, efs);
        this.createTargetGroup(fargateService);
    }

    private startFargateService(taskDef: FargateTaskDefinition): FargateService {
        const fargateService = new FargateService(this.stack, `jenkins-fargate-service`, {
            serviceName: `jenkins-fargate-service`,
            cluster: this.props.cluster,
            taskDefinition: taskDef,
            desiredCount: 1,
            vpcSubnets: {
                subnetType: SubnetType.PRIVATE
            }
        });

        fargateService.node.addDependency(this.props.cluster);
        return fargateService;
    }

    private allowPermissions(fargateService: FargateService, efs: FileSystem) {
        fargateService.connections.allowTo(
            efs,
            Port.tcp(2049),
            "allow connections from fargate service to EFS on port 2049"
        );
        fargateService.connections.allowFrom(
            this.props.loadBalancerSecurityGroup,
            Port.tcp(JENKINS_CONTAINER.PORT),
            "allow traffic from Lb security group to jenkins port"
        );
        // allow container to pull ECR image
        const defaultFargateSecurityGroup = fargateService.connections.securityGroups[0];
        const fargateSecurityGroup = SecurityGroup.fromSecurityGroupId(this.stack, 'import-jenkins-fargate', defaultFargateSecurityGroup.securityGroupId);
        fargateSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(443), "allow container to pull ecr image");
    }

    createTargetGroup(fargateService: FargateService) {
        const jenkinsTargetGroup = new ApplicationTargetGroup(this.stack, "JenkinsTargetGroup", {
            targetGroupName: `jenkins-target-group`,
            port: JENKINS_CONTAINER.PORT,
            targets: [fargateService.loadBalancerTarget({
                containerName: JENKINS_CONTAINER.NAME,
                containerPort: JENKINS_CONTAINER.PORT
            })],
            healthCheck: {
                path: "/login",
                interval: Duration.minutes(1),
                port: JENKINS_CONTAINER.PORT.toString(),
                healthyThresholdCount: 2,
                timeout: Duration.seconds(5)
            },
            vpc: this.props.vpc
        });

        const httpListener = this.props.loadBalancer.addListener("JenkinsHTTPListener", {
            protocol: ApplicationProtocol.HTTP,
            open: true,
            port: JENKINS_CONTAINER.PORT
        });

        httpListener.addAction("jenkins-listener-action", {
            action: ListenerAction.fixedResponse(200, {
                contentType: "text/plain",
                messageBody: "jenkins default action"
            })
        });

        // listener rule
        new CfnListenerRule(this.stack, "jenkins-listener-rule", {
            actions: [
                {
                    type: "forward",
                    targetGroupArn: jenkinsTargetGroup.targetGroupArn
                }
            ],
            conditions: [
                {
                    field: "path-pattern",
                    pathPatternConfig: {
                        values: ['*']
                    }
                }
            ],
            listenerArn: httpListener.listenerArn,
            priority: 100
        });
    }
}