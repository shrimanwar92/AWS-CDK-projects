import {CfnOutput, Stack, StackProps} from 'aws-cdk-lib';
import { Construct } from 'constructs';
import VPC from "./vpc";
import {IVpc, Port, Peer, InstanceType, InstanceClass, InstanceSize, Instance} from "aws-cdk-lib/aws-ec2";
import Ec2Instance from "./instance";
import {Asset} from "aws-cdk-lib/aws-s3-assets";
import {MY_IP} from "./utils";

export class BaseStack extends Stack {
    vpc: IVpc;
    constructor(scope: Construct, id: string, props?: StackProps) {
        super(scope, id, props);
        // create vpc
        this.vpc = new VPC(this).create();
    }
}

interface OpenSearchLogStashProps extends StackProps {
    vpc: IVpc
}
export class OpenSearchLogStash extends Stack {
    openSearchLogStashInstance: Instance;

    constructor(scope: Construct, id: string, props: OpenSearchLogStashProps) {
        super(scope, id, props);

        this.openSearchLogStashInstance = this.createOpenSearchInstance(props.vpc); // create opensearch and logstash instance
        this.openSearchLogStashInstance.connections.allowFrom(Peer.ipv4(MY_IP), Port.tcp(5601), "allow traffic to dashboard");
        //osInstance.connections.allowFrom(Peer.ipv4(`${appInstance.instancePublicIp}/32`), Port.tcp(5044), "allow filebeat traffic to logstash");
    }

    createOpenSearchInstance(vpc: IVpc): Instance {
        const osInstance = new Ec2Instance(this, {vpc}).create({
            name: 'oss',
            instanceType: InstanceType.of(InstanceClass.T3, InstanceSize.MEDIUM)
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

interface FileBeatStackProps extends StackProps {
    vpc: IVpc,
    logstashIP: string
}
export class FileBeatStack extends Stack {
    constructor(scope: Construct, id: string, props: FileBeatStackProps) {
        super(scope, id, props);
        this.createAppInstance(props.vpc, props.logstashIP); // create app instance

    }

    createAppInstance(vpc: IVpc, logStashIp: string): void {
        const appInstance = new Ec2Instance(this, {vpc}).create({
            name: 'filebeat',
            instanceType: InstanceType.of(InstanceClass.T2, InstanceSize.MICRO)
        });

        const fileBeatDockerComposeAsset = new Asset(this, 'fileBeatDockerComposeAsset', {path: 'docker/filebeat/docker-compose.yml'});
        const fileBeatYmlAsset = new Asset(this, 'fileBeatYml', {path: 'docker/filebeat/filebeat.yml'});
        const logAsset = new Asset(this, 'logAsset', {path: 'docker/logs/apache-log.log'});
        appInstance.userData.addS3DownloadCommand({
            bucket: fileBeatYmlAsset.bucket,
            bucketKey: fileBeatYmlAsset.s3ObjectKey,
            localFile: "/tmp/filebeat.yml"
        });
        appInstance.userData.addS3DownloadCommand({
            bucket: fileBeatDockerComposeAsset.bucket,
            bucketKey: fileBeatDockerComposeAsset.s3ObjectKey,
            localFile: "/tmp/docker-compose.yml"
        });
        appInstance.userData.addS3DownloadCommand({
            bucket: logAsset.bucket,
            bucketKey: logAsset.s3ObjectKey,
            localFile: "/tmp/logs/apache-log.log"
        });
        fileBeatYmlAsset.grantRead(appInstance.role);
        fileBeatDockerComposeAsset.grantRead(appInstance.role);
        logAsset.grantRead(appInstance.role);

        appInstance.userData.addCommands(
            //'TOKEN=`curl -X PUT -s "http://169.254.169.254/latest/api/token" -H "X-aws-ec2-metadata-token-ttl-seconds: 21600"`',
            //'INSTANCE_PUBLIC_IP=`curl -H "X-aws-ec2-metadata-token: $TOKEN" -s http://169.254.169.254/latest/meta-data/public-ipv4`',
            'cd /tmp',
            'sudo sed -i' + " s/localhost/"+logStashIp+"/g " +'filebeat.yml',
            `sudo docker-compose -f /tmp/docker-compose.yml up -d`
        );

        new CfnOutput(this, 'filebeat-ip', {
            value: appInstance.instancePublicIp,
            exportName: "Filebeat-IP"
        });
    }
}
