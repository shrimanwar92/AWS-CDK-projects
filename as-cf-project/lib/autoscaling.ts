import {Stack} from "@aws-cdk/core";
import {
    ScalableTarget,
    ServiceNamespace,
    Schedule
} from "@aws-cdk/aws-applicationautoscaling";
import {
    FargateService,
    ICluster,
} from "@aws-cdk/aws-ecs";
import {STACK_NAME} from "./utils";

interface AutoScalingProps {
    cluster: ICluster,
    service: FargateService
}

export default class AppAutoScaling {
    readonly stack: Stack;
    readonly props: AutoScalingProps;

    constructor(stack: Stack, props: AutoScalingProps) {
        this.stack = stack;
        this.props = props;
    }

    setupAutoScaling(): ScalableTarget {
        const target = new ScalableTarget(this.stack, `${STACK_NAME}-sctgt`, {
            minCapacity: 1,
            maxCapacity: 3,
            resourceId: `service/${this.props.cluster.clusterName}/${this.props.service.serviceName}`,
            //role: appAutoscalingRole,
            scalableDimension: "ecs:service:DesiredCount",
            serviceNamespace: ServiceNamespace.ECS
        });

        target.scaleOnSchedule('PrescaleInTheMorning', {
            schedule: Schedule.cron({ hour: '8', minute: '0' }),
            minCapacity: 3,
        });

        target.scaleOnSchedule('AllowDownscalingAtNight', {
            schedule: Schedule.cron({ hour: '20', minute: '0' }),
            minCapacity: 1
        });

        return target;
    }
}