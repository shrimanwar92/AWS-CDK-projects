import {Role, ServicePrincipal, ManagedPolicy} from '@aws-cdk/aws-iam';
import {IVpc, SecurityGroup} from "@aws-cdk/aws-ec2";
import {ISecret} from '@aws-cdk/aws-secretsmanager';
import * as iam from '@aws-cdk/aws-iam';
import {DBConnection, OdataStack} from './odata-stack';
import {AwsCustomResource} from '@aws-cdk/custom-resources';

interface LambdaStackProps {
    database: DBConnection,
    vpc: IVpc,
    databaseSecurityGroup: SecurityGroup,
    secret: ISecret,
    stackName: string
}

type DBParams = {
    secretArn: string,
    resourceArn: string,
    database: string
}

export class LambdaStack {
    instance: OdataStack;
    schemaCustomResource: AwsCustomResource;
    tableCustomResource: AwsCustomResource;
    private STACK_NAME: string;

    constructor(instance: OdataStack, props: LambdaStackProps) {
        this.instance = instance;
        this.STACK_NAME = props.stackName;
        if(props) {
            const params: DBParams = {
                secretArn: props.secret.secretArn,
                resourceArn: props.database.arn,
                database: props.database.databaseName
            };

            const lambdaRole = this.createLambdaRole();
            const statements = [
                this.generateS3AccessPolicy(),
                this.generateSecretsManagerDbCredentialsAccessPolicy(props.secret)
            ];

            this.schemaCustomResource = this.createSchema(params, statements, lambdaRole);
            this.tableCustomResource = this.createTable(params, statements, lambdaRole);
            // wait for schema resource to be created first before creating table (access_tokens)
            this.tableCustomResource.node.addDependency(this.schemaCustomResource);
        }
    }

    public static createSecureStringParameter(instance: OdataStack, name: string, value: string): AwsCustomResource {
        return new AwsCustomResource(instance, `odata-ssm`, {
            resourceType: "Custom::SecureStringParameter",
            onCreate: {
                service: "SSM",
                action: "putParameter",
                parameters: {
                    Name: name,
                    Value: value,
                    Type: "SecureString",
                    Overwrite: true,
                },
                physicalResourceId: {
                    id: Date.now().toString()
                }
            },
            onDelete: {
                service: "SSM",
                action: "deleteParameter",
                parameters: {
                    Name: name
                }
            },
            policy: {
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: ["*"],
                        resources: ["*"]
                    })
                ]
            }
        });
    }

    private createLambdaRole(): Role {
        return new Role(this.instance, `odata-aurora-lambda-role`, {
            assumedBy: new ServicePrincipal('lambda.amazonaws.com'),
            managedPolicies: [
                ManagedPolicy.fromAwsManagedPolicyName('AmazonRDSDataFullAccess')
            ],
            roleName: `${this.STACK_NAME}-aurora-lambda-role`
        });
    }

    // permission to read the secret arn from secrets-manager for lambda function
    // to be passed to lambda handler function as env variables
    private generateSecretsManagerDbCredentialsAccessPolicy(secret: ISecret): iam.PolicyStatement {
        return new iam.PolicyStatement({
            effect: iam.Effect.ALLOW,
            actions: [
                'secretsmanager:GetSecretValue',
                'secretsmanager:DescribeSecret'
            ],
            resources: [
                secret.secretArn
            ]
        });
    }

    // require to access code zip file from s3 bucket for custom resource
    private generateS3AccessPolicy(): iam.PolicyStatement {
        return new iam.PolicyStatement({
            actions: ["s3:*"],
            effect: iam.Effect.ALLOW,
            resources: ["*"],
        });
    }

    private createSchema(params: DBParams, statements: iam.PolicyStatement[], lambdaRole: Role): AwsCustomResource {
        return new AwsCustomResource(this.instance, `odata-custom-resource-1`, {
            resourceType: "Custom::InvokeLambda1",
            onCreate: {
                service: "RDSDataService",
                action: "executeStatement",
                parameters: {
                    ...params,
                    sql: "CREATE SCHEMA IF NOT EXISTS nimbus;"
                },
                physicalResourceId: {
                    id: Date.now().toString()
                }
            },
            onDelete: {
                service: "RDSDataService",
                action: "executeStatement",
                parameters: {
                    ...params,
                    sql: "DROP SCHEMA nimbus CASCADE;"
                }
            },
            policy: {
                statements: statements
            },
            role: lambdaRole,
        });
    }

    private createTable(params: DBParams, statements: iam.PolicyStatement[], lambdaRole: Role): AwsCustomResource {
        return new AwsCustomResource(this.instance, `odata-custom-resource-2`, {
            resourceType: "Custom::InvokeLambda2",
            onCreate: {
                service: "RDSDataService",
                action: "executeStatement",
                parameters: {
                    ...params,
                    sql: `CREATE TABLE IF NOT EXISTS nimbus.access_tokens (
                            id int4 NOT NULL GENERATED BY DEFAULT AS IDENTITY,
                            sub_id varchar(40) NOT NULL,
                            username varchar(250) NOT NULL,
                            "token" varchar(20) NOT NULL,
                            expires timestamp NOT NULL
                           );`
                },
                physicalResourceId: {
                    id: Date.now().toString()
                }
            },
            policy: {
                statements: statements
            },
            role: lambdaRole,
        });
    }
}