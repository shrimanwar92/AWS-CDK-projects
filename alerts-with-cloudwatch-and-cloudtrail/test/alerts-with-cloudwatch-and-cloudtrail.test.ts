import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AlertsWithCloudwatchAndCloudtrail from '../lib/alerts-with-cloudwatch-and-cloudtrail-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AlertsWithCloudwatchAndCloudtrail.AlertsWithCloudwatchAndCloudtrailStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
