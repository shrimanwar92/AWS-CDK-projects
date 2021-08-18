import {Stack} from "@aws-cdk/core";
import {Schedule} from "@aws-cdk/aws-applicationautoscaling";
import {FargateService, ICluster} from "@aws-cdk/aws-ecs";
import {AUTOSCALING} from "./utils";

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

    setupAutoScaling(): AppAutoScaling {
        const target = this.props.service.autoScaleTaskCount({
            minCapacity: 1,
            maxCapacity: 3
        });

        // the time is in UTC
        target.scaleOnSchedule('upscale-in-morning', {
            schedule: Schedule.cron({ hour: AUTOSCALING.UP_SCALING_TIME.hour, minute: AUTOSCALING.UP_SCALING_TIME.min }),
            minCapacity: 3,
        });

        // the time is in UTC
        target.scaleOnSchedule('downscale-at-night', {
            schedule: Schedule.cron({ hour: AUTOSCALING.DOWN_SCALING_TIME.hour, minute: AUTOSCALING.DOWN_SCALING_TIME.min }),
            minCapacity: 1
        });

        return this;
    }
}