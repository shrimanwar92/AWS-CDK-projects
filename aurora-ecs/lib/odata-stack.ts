import {CfnParameter, Construct, Fn, Stack, StackProps, ScopedAws} from "@aws-cdk/core";
import {IVpc, Port, SecurityGroup, Vpc, ISecurityGroup} from "@aws-cdk/aws-ec2";
import {CfnDBCluster, CfnDBSubnetGroup} from '@aws-cdk/aws-rds';
import {StringParameter} from '@aws-cdk/aws-ssm';
import {ISecret, Secret} from '@aws-cdk/aws-secretsmanager';
import {IRepository, Repository} from "@aws-cdk/aws-ecr";
import {ContainerStack} from './container-stack';
import {LambdaStack} from "./lambda-stack";
import {DATABASE_PORT, DATABASE_NAME, AURORA_ENGINE_VERSION} from "./utils";
import {
    ApplicationListener,
    ApplicationLoadBalancer, IApplicationListener,
    IApplicationLoadBalancer,
} from "@aws-cdk/aws-elasticloadbalancingv2";

export interface InfrastructureStackProps extends StackProps {
    vpcId: string,
    azs: string,
    loadbalancerArn: string,
    securityGroupId: string,
    privateSubnetIds: string,
    repositoryName?: string,
    listenerArn: string
}

interface CustomApplicationLoadBalancer extends IApplicationLoadBalancer {
    listener: IApplicationListener,
    loadBalancerSecurityGroup: ISecurityGroup
}

export interface DatabaseStackProps {
    vpc: IVpc,
    elb: CustomApplicationLoadBalancer,
    repository: IRepository,
    databaseSecurityGroup: SecurityGroup,
    stackName?: string
}

export type DBConnection = {
    endpoint: string,
    port: string,
    userName: string,
    password: string,
    databaseName: string,
    arn: string
}

export class OdataStack extends Stack {
    public readonly secret: ISecret;
    public readonly database: DBConnection;
    public readonly databaseSecurityGroup: SecurityGroup;
    public aurora: CfnDBCluster;
    public vpc: IVpc;
    public loadBalancer: CustomApplicationLoadBalancer;
    public repository: IRepository;
    private STACK_NAME: string;

    constructor(scope: Construct, id: string, props?: InfrastructureStackProps) {
        super(scope, id, props);

        this.STACK_NAME = new ScopedAws(this).stackName;

        const userName = new CfnParameter(this, "databaseUserName", {type: "String", description: "Tokens/export database username"}).valueAsString;
        const password = new CfnParameter(this, "databasePassword", {type: "String", description: "Tokens/export database password. (It should be atleast 8 characters in length )", allowedPattern: ".{8,}", constraintDescription: "Password should be atleast 8 characters in length"}).valueAsString;
        const vpcid = props?.vpcId || new CfnParameter(this, "vpcId", {type: "String", description: "VPC from existing cloud infrastructure"}).valueAsString;
        const azs = props?.azs || new CfnParameter(this, "azs", {type: "String", description: "Comma separated values of availability zones in the region to fetch existing VPC"}).valueAsString;
        const loadbalancerArn = props?.loadbalancerArn || new CfnParameter(this, "loadBalancerArn", {type: "String", description: "Loadbalancer ARN to fetch existing loadbalancer"}).valueAsString;
        const securityGroupId = props?.securityGroupId || new CfnParameter(this, "securityGroupId", {type: "String", description: "Security group id to fetch existing loadbalancer"}).valueAsString;
        const privateSubnetIds = props?.privateSubnetIds || new CfnParameter(this, "privateSubnetIds", {type: "String", description: "At least 2 comma-separated IDs of private subnets in different availability zones (DB+container deployed into each subnet)"}).valueAsString;
        const repositoryName = props?.repositoryName || new CfnParameter(this, "repositoryName", {type: "String", description: "Name of the AWS ECR repository with the OData service image (Repository name must start with a letter and can only contain lowercase letters, numbers, hyphens, underscores, and forward slashes)"}).valueAsString;
        const listenerArn = props?.listenerArn ||  new CfnParameter(this, "listenerArn", {type: "String", description: "Listener ARN to fetch existing listener"}).valueAsString;

        this.vpc = this.getExistingVPC(vpcid, azs, privateSubnetIds);
        this.loadBalancer = this.getExistingLoadBalancer(loadbalancerArn, securityGroupId, listenerArn);

        // make sure the repository already exists and image is present or the deployment will fail
        this.repository = Repository.fromRepositoryName(this, `odata-import-repository`, repositoryName);

        if(props) {
            this.databaseSecurityGroup = this.createDBSecurityGroup();
            const dbSubnetGroup = this.createDbSubnetGroup();
            this.secret = this.createSecret(userName, password);
            this.database = this.createAuroraDB(userName, password, dbSubnetGroup);

            // initialize container instance
            const container = new ContainerStack(this, {
                vpc: this.vpc,
                elb: this.loadBalancer,
                repository: this.repository,
                databaseSecurityGroup: this.databaseSecurityGroup,
                stackName: this.STACK_NAME
            });

            const parameter = this.createSecureStringParameter();
            parameter.grantRead(container.taskRole);

            // create container
            container.createContainer(parameter);
            this.createLambdaStack();
        }
    }

    private createLambdaStack() {
        const lambda = new LambdaStack(this, {
            database: this.database,
            vpc: this.vpc,
            databaseSecurityGroup: this.databaseSecurityGroup,
            secret: this.secret,
            stackName: this.STACK_NAME
        });

        //wait for db to be created first
        lambda.schemaCustomResource.node.addDependency(this.aurora);
    }

    private createAuroraDB(userName: string, password: string, dbSubnetGroup: CfnDBSubnetGroup): DBConnection {
        this.aurora = new CfnDBCluster(this, `odata-db-cluster`, {
            dbSubnetGroupName: dbSubnetGroup.dbSubnetGroupName?.toLowerCase(), // expects subnet group to be in lowercase
            engineMode: 'serverless',
            engine: 'aurora-postgresql',
            engineVersion: AURORA_ENGINE_VERSION,
            enableHttpEndpoint: true,
            databaseName: DATABASE_NAME,
            masterUsername: userName,
            masterUserPassword: password,
            scalingConfiguration: {
                autoPause: true,
                maxCapacity: 2,
                minCapacity: 2,
                secondsUntilAutoPause: 300,
            },
            vpcSecurityGroupIds: [
                this.databaseSecurityGroup.securityGroupId
            ]
        });

        this.aurora.addPropertyOverride('DBSubnetGroupName', {
            "Fn::Join": [
                "",
                [
                    {
                        "Ref": "AWS::StackName"
                    },
                    "-aurora-subnet-group"
                ]
            ]
        });

        //wait for subnet group to be created
        this.aurora.addDependsOn(dbSubnetGroup);

        return {
            endpoint: this.aurora.attrEndpointAddress,
            port: this.aurora.attrEndpointPort,
            userName: this.aurora.masterUsername || '',
            password: this.aurora.masterUserPassword || '',
            databaseName: DATABASE_NAME,
            arn: `arn:aws:rds:${this.region}:${this.account}:cluster:${this.aurora.ref}`
        };
    }

    private createDbSubnetGroup(): CfnDBSubnetGroup {
        const privateSubnetIds = this.vpc.privateSubnets.map(subnet => subnet.subnetId);

        const subnetGroup = new CfnDBSubnetGroup(this, `odata-aurora-serverless-subnet-group`, {
            dbSubnetGroupDescription: 'Subnet group to access aurora',
            subnetIds: privateSubnetIds
        });
        subnetGroup.addPropertyOverride('DBSubnetGroupName', {
            "Fn::Join": [
                "",
                [
                    {
                        "Ref": "AWS::StackName"
                    },
                    "-aurora-subnet-group"
                ]
            ]
        });
        subnetGroup.node.addDependency(this.vpc);

        return subnetGroup;
    }

    private getExistingVPC(vpcId: string, azs: string, privateSubnetIds: string): IVpc {
        return Vpc.fromVpcAttributes(this, `odata-import-VPC`, {
            vpcId: vpcId,
            availabilityZones: Fn.split(",", azs),
            privateSubnetIds: Fn.split(",", privateSubnetIds)
        });
    }

    private getExistingLoadBalancer(arn: string, sgid: string, listenerArn: string): CustomApplicationLoadBalancer {
        const loadBalancer = ApplicationLoadBalancer.fromApplicationLoadBalancerAttributes(this, `odata-loadbalancer`, {
            loadBalancerArn: arn,
            securityGroupId: sgid,
            vpc: this.vpc
        });

        const securityGroup = SecurityGroup.fromSecurityGroupId(this, "import-sg", sgid);

        // wait for vpc to be created first before creating loadbalancer
        loadBalancer.node.addDependency(this.vpc);

        const listener = this.addListener(listenerArn, securityGroup);
        return {
            ...loadBalancer,
            listener,
            loadBalancerSecurityGroup: securityGroup
        };
    }

    private addListener(listenerArn: string, securityGroup: ISecurityGroup): IApplicationListener {
        const listener = ApplicationListener.fromApplicationListenerAttributes(this, "odata-import-listener", {
            listenerArn,
            securityGroup
        });
        return listener;
    }

    private createDBSecurityGroup(): SecurityGroup {
        const securityGroup = new SecurityGroup(this, `odata-rds-sg`, {
            vpc: this.vpc,
            allowAllOutbound: true,
            description: 'rds db security group',
            securityGroupName: `${this.STACK_NAME}-rds-sg`
        });
        securityGroup.node.addDependency(this.vpc);
        securityGroup.connections.allowFromAnyIpv4(Port.tcp(DATABASE_PORT));

        return securityGroup;
    }

    private createSecret(userName: string, password: string): ISecret {
        return new Secret(this, `odata-rds-secret`, {
            secretName: `${this.STACK_NAME}-rds-secret`,
            generateSecretString: {
                secretStringTemplate:`{"username": "${userName}", "password": "${password}", "database": "${DATABASE_NAME}"}`,
                generateStringKey: password
            }
        });
    }

    private createSecureStringParameter(): StringParameter {
        const connectionString = `Host=${this.database.endpoint};Database=${this.database.databaseName};Username=${this.database.userName};Password=${this.database.password};Timeout=60;CommandTimeout=60`;
        const parameterCustomResource = LambdaStack.createSecureStringParameter(this, `${this.STACK_NAME}-db-conn-string`, connectionString);
        const parameter = <StringParameter>StringParameter.fromSecureStringParameterAttributes(this, `odata-import-ssm`, {
            parameterName: `${this.STACK_NAME}-db-conn-string`,
            version: 1,
            simpleName: true
        });
        // wait for parameter custom resource to be created first
        parameter.node.addDependency(parameterCustomResource);

        return parameter;
    }
}