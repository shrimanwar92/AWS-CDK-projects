import {Stack} from "@aws-cdk/core";
import {Instance, ISecurityGroup, IVpc, Port, SecurityGroup} from "@aws-cdk/aws-ec2";
import {CfnLaunchConfiguration, CfnAutoScalingGroup} from "@aws-cdk/aws-autoscaling";
import {STACK_NAME} from "./utils";
import {IApplicationTargetGroup} from "@aws-cdk/aws-elasticloadbalancingv2";

interface ASGProps {
    instance: Instance,
    albSecurityGroup: ISecurityGroup,
    targetGroup: IApplicationTargetGroup,
    vpc: IVpc
}

export class AutoScaling {
    stack: Stack;
    props: ASGProps;

    constructor(stack: Stack, props: ASGProps) {
        this.stack = stack;
        this.props = props;
    }

    createAutoScaling() {
        const launchConfiguration = this.createLaunchConfiguration();
        const asg = new CfnAutoScalingGroup(this.stack, `${STACK_NAME}-asg`, {
            minSize: "1",
            maxSize: "2",
            vpcZoneIdentifier: this.props.vpc.privateSubnets.map(subnet => subnet.subnetId),
            availabilityZones: this.stack.availabilityZones,
            launchConfigurationName: launchConfiguration.ref,
            desiredCapacity: "1",
            healthCheckType: 'ELB',
            healthCheckGracePeriod: 60,
            targetGroupArns: [this.props.targetGroup.targetGroupArn],
        });
        asg.addDependsOn(launchConfiguration);
    }

    private createLaunchConfiguration(): CfnLaunchConfiguration {
        const asgSecurityGroup = this.createSecurityGroup();

        const lc = new CfnLaunchConfiguration(this.stack, `${STACK_NAME}-launch-config`, {
            instanceId: this.props.instance.instanceId,
            imageId: this.props.instance.instance.imageId!,
            instanceType: this.props.instance.instance.instanceType!,
            securityGroups: [asgSecurityGroup.securityGroupId]
        });
        lc.addDependsOn(this.props.instance.instance);

        return lc;
    }

    private createSecurityGroup(): ISecurityGroup {
        const asgSecurityGroup = new SecurityGroup(this.stack, `${STACK_NAME}-sg-ec2`, {
            securityGroupName: `${STACK_NAME}-asg-sg`,
            description: "security group for asg",
            vpc: this.props.vpc,
            allowAllOutbound: true
        });

        asgSecurityGroup.node.addDependency(this.props.albSecurityGroup);
        asgSecurityGroup.connections.allowFrom(this.props.albSecurityGroup, Port.tcp(80), "allow connection from ALB to ASG")

        return asgSecurityGroup;
    }
}