import {CfnOutput, Stack, StackProps} from 'aws-cdk-lib';
import {Construct} from 'constructs';
import VPC from "./vpc";
import {
    Instance,
    InstanceClass,
    InstanceSize,
    InstanceType,
    IVpc,
    Peer,
    Port,
    SecurityGroup
} from "aws-cdk-lib/aws-ec2";
import Ec2Instance from "./instance";
import {Asset} from "aws-cdk-lib/aws-s3-assets";
import {MY_IP, NUMBER_OF_INSTANCES} from "./utils";
import {createDefaultEC2Role, createMetricBeatRole} from './roles';
import {Role} from "aws-cdk-lib/aws-iam";
import {createDefaultEC2SecurityGroup} from "./security-groups";

export class BaseStack extends Stack {
    vpc: IVpc;
    defaultEC2SecurityGroup: SecurityGroup;
    defaultEC2Role: Role;
    metricBeatRole: Role;

    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        // create vpc
        this.vpc = new VPC(this).create();
        this.defaultEC2SecurityGroup = createDefaultEC2SecurityGroup(this, this.vpc, "app");
        this.defaultEC2Role = createDefaultEC2Role(this);
        this.metricBeatRole = createMetricBeatRole(this);
    }
}

interface OpenSearchLogStashProps extends StackProps {
    vpc: IVpc,
    defaultEC2Role: Role
}
export class OpenSearchLogStash extends Stack {
    openSearchLogStashInstance: Instance;

    constructor(scope: Construct, id: string, props: OpenSearchLogStashProps) {
        super(scope, id, props);

        const openSearchSecurityGroup = createDefaultEC2SecurityGroup(this, props.vpc, "oss");
        this.openSearchLogStashInstance = this.createOpenSearchInstance(props.vpc, props.defaultEC2Role, openSearchSecurityGroup); // create opensearch and logstash instance
        this.openSearchLogStashInstance.connections.allowFrom(Peer.ipv4(MY_IP), Port.tcp(5601), "allow traffic to dashboard");
        this.openSearchLogStashInstance.connections.allowFrom(Peer.anyIpv4(), Port.tcp(5044), "allow filebeat traffic to logstash");
    }

    createOpenSearchInstance(vpc: IVpc, role: Role, securityGroup: SecurityGroup): Instance {
        const osInstance = new Ec2Instance(this, {vpc}).create({
            name: 'oss',
            instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM),
            role, securityGroup
        });

        const dockerComposeAsset = new Asset(this, 'dockerComposeAsset', {path: 'docker/docker-compose.yml'});
        const logStashConfAsset = new Asset(this, 'logStashConfAsset', {path: 'docker/logstash/logstash.conf'});

        osInstance.userData.addS3DownloadCommand({
            bucket: dockerComposeAsset.bucket,
            bucketKey: dockerComposeAsset.s3ObjectKey,
            localFile: "/tmp/docker-compose.yml"
        });

        osInstance.userData.addS3DownloadCommand({
            bucket: logStashConfAsset.bucket,
            bucketKey: logStashConfAsset.s3ObjectKey,
            localFile: "/tmp/logstash.conf"
        });

        dockerComposeAsset.grantRead(osInstance.role);
        logStashConfAsset.grantRead(osInstance.role);

        // run docker-compose.yml
        osInstance.userData.addCommands(
            'cd /tmp',
            'sudo docker-compose -f /tmp/docker-compose.yml up -d'
        );

        new CfnOutput(this, 'opensearch-logstash-ip', {
            value: osInstance.instancePublicIp,
            exportName: "Opensearch-Logstash-IP"
        });

        return osInstance;
    }
}

interface AppStackProps extends StackProps {
    vpc: IVpc,
    logstashIP: string,
    defaultEC2Role: Role,
    defaultEC2SecurityGroup: SecurityGroup,
    metricBeatRole: Role
}
export class AppStack extends Stack {
    constructor(scope: Construct, id: string, props: AppStackProps) {
        super(scope, id, props);

        // create 2 instances
        for(let i=1; i<=NUMBER_OF_INSTANCES; i++) {
            this.createAppInstance({
                vpc: props.vpc,
                logStashIp: props.logstashIP,
                metricBeatRoleArn: props.metricBeatRole.roleArn,
                name: `app${i}`,
                role: props.defaultEC2Role,
                sg: props.defaultEC2SecurityGroup
            });

            props.defaultEC2SecurityGroup.addIngressRule(Peer.ipv4(MY_IP), Port.tcp(3000), "allow traffic from MY IP to 3000");
        }
    }

    createAppInstance(options: {vpc: IVpc, logStashIp: string, metricBeatRoleArn: string, name: string, role: Role, sg: SecurityGroup}): void {
        const appInstance = new Ec2Instance(this, {vpc: options.vpc}).create({
            name: options.name,
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO),
            role: options.role,
            securityGroup: options.sg
        });

        const beatsDockerComposeAsset = new Asset(this, `beatsDockerComposeAsset-${options.name}`, {path: 'docker/beats/docker-compose.yml'});
        const fileBeatYmlAsset = new Asset(this, `fileBeatYml-${options.name}`, {path: 'docker/beats/filebeat.yml'});
        // const logAsset = new Asset(this, `logAsset-${options.name}`, {path: 'docker/logs/apache-log.log'});
        const metricBeatYmlAsset = new Asset(this, `metricBeatYml-${options.name}`, {path: 'docker/beats/metricbeat.yml'});

        appInstance.userData.addS3DownloadCommand({
            bucket: beatsDockerComposeAsset.bucket,
            bucketKey: beatsDockerComposeAsset.s3ObjectKey,
            localFile: "/tmp/docker-compose.yml"
        });

        appInstance.userData.addS3DownloadCommand({
            bucket: fileBeatYmlAsset.bucket,
            bucketKey: fileBeatYmlAsset.s3ObjectKey,
            localFile: "/tmp/filebeat.yml"
        });

        appInstance.userData.addS3DownloadCommand({
            bucket: metricBeatYmlAsset.bucket,
            bucketKey: metricBeatYmlAsset.s3ObjectKey,
            localFile: "/tmp/metricbeat.yml"
        });

        /*appInstance.userData.addS3DownloadCommand({
            bucket: logAsset.bucket,
            bucketKey: logAsset.s3ObjectKey,
            localFile: "/tmp/logs/apache-log.log"
        });*/

        fileBeatYmlAsset.grantRead(appInstance.role);
        metricBeatYmlAsset.grantRead(appInstance.role);
        beatsDockerComposeAsset.grantRead(appInstance.role);
        //logAsset.grantRead(appInstance.role);

        appInstance.userData.addCommands(
            //'TOKEN=`curl -X PUT -s "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`',
            //'INSTANCE_PUBLIC_IP=`curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/public-ipv4`',
            'cd /tmp',
            'sudo sed -i' + " s/localhost/"+options.logStashIp+"/g " +'filebeat.yml',
            'sudo sed -i' + " s/localhost/"+options.logStashIp+"/g " +'metricbeat.yml',
            // 'sudo sed -i' + " s/roleArn/"+options.metricBeatRoleArn+"/g " +'metricbeat.yml',
            `sudo docker-compose -f /tmp/docker-compose.yml up -d`
        );

        new CfnOutput(this, `instance-ip-${options.name}`, {
            value: appInstance.instancePublicIp
        });
    }
}
