import {Stack} from "aws-cdk-lib";
import {AwsCustomResource} from "aws-cdk-lib/custom-resources";
import * as iam from "aws-cdk-lib/aws-iam";
import {DEPLOYMENT_GRP_NAME, STACK_NAME} from "./utils";
import {EcsDeploymentGroupProps} from './deploy-stage';

export default class CustomResource {
    readonly stack: Stack;

    constructor(stack: Stack) {
        this.stack = stack;
    }

    private static getParams(properties: EcsDeploymentGroupProps) {
        return {
            applicationName: properties.applicationName,
            deploymentGroupName: DEPLOYMENT_GRP_NAME,
            deploymentConfigName: 'CodeDeployDefault.ECSAllAtOnce',
            serviceRoleArn: properties.serviceRoleArn,
            ecsServices: [{
                clusterName: properties.ecsClusterName,
                serviceName: properties.ecsServiceName
            }],

            loadBalancerInfo: {
                targetGroupPairInfoList: [{
                    prodTrafficRoute: {
                        listenerArns: [properties.prodListenerArn]
                    },
                    testTrafficRoute: {
                        listenerArns: [properties.testListenerArn]
                    },
                    targetGroups: [{
                        name: properties.blueTargetGroup
                    }, {
                        name: properties.greenTargetGroup
                    }],
                }]
            },

            deploymentStyle: {
                deploymentType: 'BLUE_GREEN',
                deploymentOption: 'WITH_TRAFFIC_CONTROL'
            },

            autoRollbackConfiguration: {
                enabled: true,
                events: [
                    'DEPLOYMENT_FAILURE', 'DEPLOYMENT_STOP_ON_ALARM', 'DEPLOYMENT_STOP_ON_REQUEST',
                ]
            },

            blueGreenDeploymentConfiguration: {
                terminateBlueInstancesOnDeploymentSuccess: {
                    action: 'TERMINATE',
                    terminationWaitTimeInMinutes: properties.terminationWaitTimeInMinutes
                },
                deploymentReadyOption: {
                    actionOnTimeout: 'CONTINUE_DEPLOYMENT'
                }
            },
        };
    }

    createCodeDeployDeploymentGroup(properties: EcsDeploymentGroupProps): AwsCustomResource {
        return new AwsCustomResource(this.stack, `${STACK_NAME}-cs-dg`, {
            resourceType: 'Custom::deploymentGroup',
            onCreate: {
                service: "CodeDeploy",
                action: "createDeploymentGroup",
                parameters: CustomResource.getParams(properties),
                physicalResourceId: {
                    id: Date.now().toString()
                }
            },
            onUpdate: {
                service: "CodeDeploy",
                action: "updateDeploymentGroup",
                parameters: {
                    ...CustomResource.getParams(properties),
                    currentDeploymentGroupName: DEPLOYMENT_GRP_NAME
                },
                physicalResourceId: {
                    id: Date.now().toString()
                }
            },
            onDelete: {
                service: "CodeDeploy",
                action: "deleteDeploymentGroup",
                parameters: {
                    applicationName: properties.ecsServiceName,
                    deploymentGroupName: DEPLOYMENT_GRP_NAME
                }
            },
            policy: {
                statements: [
                    new iam.PolicyStatement({
                        effect: iam.Effect.ALLOW,
                        actions: [
                            'iam:PassRole',
                            'sts:AssumeRole',
                            'codedeploy:List*',
                            'codedeploy:Get*',
                            'codedeploy:UpdateDeploymentGroup',
                            'codedeploy:CreateDeploymentGroup',
                            'codedeploy:DeleteDeploymentGroup'
                        ],
                        resources: ["*"]
                    })
                ]
            }
        })
    }
}