import { expect as expectCDK, matchTemplate, MatchStyle } from '@aws-cdk/assert';
import * as cdk from '@aws-cdk/core';
import * as AttributeBasedAccessControl from '../lib/attribute-based-access-control-stack';

test('Empty Stack', () => {
    const app = new cdk.App();
    // WHEN
    const stack = new AttributeBasedAccessControl.AttributeBasedAccessControlStack(app, 'MyTestStack');
    // THEN
    expectCDK(stack).to(matchTemplate({
      "Resources": {}
    }, MatchStyle.EXACT))
});
