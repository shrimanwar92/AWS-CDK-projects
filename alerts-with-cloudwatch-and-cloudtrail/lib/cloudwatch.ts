import {Duration, Stack} from "@aws-cdk/core";
import {STACK_NAME} from "./utils";
import {Alarm, IAlarm, Metric, Statistic} from "@aws-cdk/aws-cloudwatch";
import {ILogGroup, MetricFilter, LogGroup} from "@aws-cdk/aws-logs";
import {Trail} from "@aws-cdk/aws-cloudtrail";
import {SnsAction} from "@aws-cdk/aws-cloudwatch-actions";
import {ITopic} from "@aws-cdk/aws-sns";

export default class MyCloudWatch {
    readonly stack: Stack;
    readonly ec2StoppedInstanceCountMetric: Metric;
    logGroup: ILogGroup;

    constructor(stack: Stack) {
        this.stack = stack;

        this.logGroup = new LogGroup(stack, 'LogGroup', {
            logGroupName: "my-logs"
        });
        this.ec2StoppedInstanceCountMetric = new Metric({
            namespace: "CloudTrailMetrics",
            metricName: "EC2stoppedInstanceEventCount"
        });
    }

    createTrail() {
        const trail = new Trail(this.stack, `${STACK_NAME}-trail`, {
            trailName: "my-cloud-trail",
            s3KeyPrefix: "my-cloud-trail-bucket",
            cloudWatchLogGroup: this.logGroup,
            sendToCloudWatchLogs: true
        });
        trail.node.addDependency(this.logGroup);
    }

    createMetricFilter() {
        const filterPattern = { logPatternString: '{ $.eventName="StopInstances" }' }
        const metricFilter = new MetricFilter(this.stack, `${STACK_NAME}-metric-filter`, {
            metricName: this.ec2StoppedInstanceCountMetric.metricName,
            metricNamespace: this.ec2StoppedInstanceCountMetric.namespace,
            logGroup: this.logGroup,
            filterPattern: filterPattern,
            metricValue: "1"
        });
        metricFilter.node.addDependency(this.logGroup);
    }

    createAlarm(topic: ITopic) {
        const alarm = new Alarm(this.stack, `${STACK_NAME}-alarm`, {
            alarmName: "my-alarm",
            threshold: 1,
            evaluationPeriods: 1,
            metric: this.ec2StoppedInstanceCountMetric.with({
                statistic: Statistic.SUM,
                period: Duration.minutes(1)
            })
        });

        const action = new SnsAction(topic);
        alarm.addAlarmAction(action);
    }
}