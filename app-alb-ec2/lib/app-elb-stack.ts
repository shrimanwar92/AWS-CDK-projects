import * as cdk from '@aws-cdk/core';
import {
    Instance, IInstance,
    InstanceClass, InstanceSize, InstanceType,
    Peer,
    Port,
    SecurityGroup, ISecurityGroup,
    SubnetType,
    UserData,
    Vpc, IVpc,
    AmazonLinuxImage,
} from "@aws-cdk/aws-ec2";
import {
    ApplicationLoadBalancer,
    ContentType,
    IApplicationLoadBalancer,
    ListenerAction,
    ApplicationTargetGroup, ListenerCondition, IApplicationListener
} from "@aws-cdk/aws-elasticloadbalancingv2";
import {Role, ServicePrincipal, ManagedPolicy} from "@aws-cdk/aws-iam";
import {InstanceTarget} from "@aws-cdk/aws-elasticloadbalancingv2-targets";

const STACK_NAME = "tor";

interface CustomApplicationLoadBalancer {
    loadBalancer: IApplicationLoadBalancer,
    listener: IApplicationListener
}

export class InfraStack extends cdk.Stack {
    vpc: IVpc;
    lb: CustomApplicationLoadBalancer;
    lbSecurityGroup: ISecurityGroup;
    instance: Instance;
    instanceSecurityGroup: ISecurityGroup;

    constructor(scope: cdk.Construct, id: string, props?: cdk.StackProps) {
        super(scope, id, props);

        // create vpc
        this.vpc = this.createVpcWithIGW();

        // create loadbalancer
        this.lb = this.createLoadBalancer();

        // create ec2 instance
        this.instance = this.createEC2Instance();

        // create target group
        this.setListenerTarget();
    }

    private setListenerTarget() {
        // create a target group with health check
        // add the EC2 instance as a target
        const targetGroup = new ApplicationTargetGroup(this, `${STACK_NAME}-tg`, {
            targetGroupName: `${STACK_NAME}-tg`,
            port: 80,
            targets: [new InstanceTarget(this.instance, 80)],
            healthCheck: {
                path: "/",
                interval: cdk.Duration.seconds(30)
            },
            vpc: this.vpc
        });

        // configure the target in the listener
        this.lb.listener.addTargetGroups(`${STACK_NAME}-tg12`, {
            priority: 1,
            targetGroups: [targetGroup],
            conditions: [
                ListenerCondition.pathPatterns(['/'])
            ]
        });
    }

    private createEC2Instance(): Instance {
        const role = new Role(this, `${STACK_NAME}-ec2-role`, {
            roleName: `${STACK_NAME}-ec2-role`,
            assumedBy: new ServicePrincipal("ec2.amazonaws.com")
        });
        role.addManagedPolicy(ManagedPolicy.fromAwsManagedPolicyName("AmazonSSMManagedInstanceCore"));

        this.instanceSecurityGroup = new SecurityGroup(this, `${STACK_NAME}-sg-lb`, {
            securityGroupName: `${STACK_NAME}-instance-sg`,
            description: "security group for ec2 instance",
            vpc: this.vpc,
            allowAllOutbound: true
        });
        this.instanceSecurityGroup.node.addDependency(this.lbSecurityGroup);
        this.instanceSecurityGroup.connections.allowFrom(this.lbSecurityGroup, Port.tcp(80), "allow conn from lb-security-grp to instance-security-grp");

        const userData = UserData.forLinux();
        userData.addCommands(
            `yum install httpd -y`,
            `echo "<h1>Response from server</h1>" > /var/www/html/index.html`,
            `chkconfig httpd on`,
            `service httpd start`
        );

        const instance = new Instance(this, `${STACK_NAME}-ec2`, {
            vpc: this.vpc,
            vpcSubnets: {
                subnets: this.vpc.publicSubnets
            },
            instanceName: `${STACK_NAME}-ec2-instance`,
            instanceType: InstanceType.of(InstanceClass.BURSTABLE2, InstanceSize.MICRO),
            machineImage: new AmazonLinuxImage(),
            userData: userData,
            role: role,
            securityGroup: this.instanceSecurityGroup
        });

        instance.node.addDependency(this.vpc);

        return instance;
    }

    private createVpcWithIGW(): IVpc {
        const vpc = new Vpc(this, `${STACK_NAME}-vpc`, {
            subnetConfiguration: [{
                cidrMask: 24,
                name: 'public',
                subnetType: SubnetType.PUBLIC
            },{
                cidrMask: 24,
                name: 'private',
                subnetType: SubnetType.PRIVATE
            }]
        });
        return vpc;
    }

    private createLoadBalancer(): CustomApplicationLoadBalancer {
        this.lbSecurityGroup = new SecurityGroup(this, `${STACK_NAME}-lb-sg`, {
            securityGroupName: `${STACK_NAME}-sg`,
            description: "security group for load balancer",
            vpc: this.vpc,
            allowAllOutbound: true
        });
        this.lbSecurityGroup.addIngressRule(Peer.anyIpv4(), Port.tcp(80), "allow traffic on port 80");

        const lb = new ApplicationLoadBalancer(this, `${STACK_NAME}-lb`, {
            loadBalancerName: `${STACK_NAME}-lb`,
            vpc: this.vpc,
            internetFacing: true,
            securityGroup: this.lbSecurityGroup
        });

        // wait for vpc and security group to be created first
        lb.node.addDependency(this.vpc, this.lbSecurityGroup);

        // create a listener
        const listener = lb.addListener(`${STACK_NAME}-listener`, {
           port: 80,
           open: true,
        });
        listener.addAction("listener-action", {
            action: ListenerAction.fixedResponse(200, {
                contentType: ContentType.TEXT_PLAIN,
                messageBody: "AAAAAAA RRRRRRR RRRRRRR AAAAAAAAAA"
            })
        });

        return {
            loadBalancer: lb,
            listener
        };
    }
}
