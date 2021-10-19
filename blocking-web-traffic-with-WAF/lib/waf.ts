import {Stack} from "@aws-cdk/core";
import {CfnByteMatchSet, CfnIPSet, CfnRule, CfnSqlInjectionMatchSet, CfnWebACL, CfnWebACLAssociation} from "@aws-cdk/aws-wafregional";
import {IApplicationLoadBalancer} from "@aws-cdk/aws-elasticloadbalancingv2";
import {STACK_NAME} from "./utils";

interface WAFProps {
    loadBalancer: IApplicationLoadBalancer
}

export default class MyWAF {
    readonly stack: Stack;
    readonly props: WAFProps;
    rules: any = [];

    constructor(stack: Stack, props: WAFProps) {
        this.stack = stack;
        this.props = props;
    }

    setQueryStringRule() {
        const queryStringMatchSet = new CfnByteMatchSet(this.stack, "QueryStringMatchSet", {
            name: "QueryStringMatchSet",
            byteMatchTuples: [{
                fieldToMatch: {
                    type: "QUERY_STRING"
                },
                targetString: "admin",
                textTransformation: "NONE",
                positionalConstraint: "EXACTLY"
            }]
        });

        const rule = new CfnRule(this.stack, `${STACK_NAME}-query-str-rule`, {
            name: "QueryStringRule",
            metricName: "QueryStringRule",
            predicates: [{
                dataId: queryStringMatchSet.ref,
                negated: false,
                type: "ByteMatch"
            }]
        });

        this.rules.push({
            action: {type: 'BLOCK'},
            priority: 2,
            ruleId: rule.ref,
        });
    }

    setSQLInjectionRule() {
        const sqlinj = new CfnSqlInjectionMatchSet(this.stack, "SqlInjectionMatchSet", {
            name: "SqlInjectionMatchSet",
            sqlInjectionMatchTuples: [{
                fieldToMatch: {
                    type: "QUERY_STRING"
                },
                textTransformation: "URL_DECODE"
            }]
        });

        const rule = new CfnRule(this.stack, `${STACK_NAME}-sql-inj-rule`, {
            name: "SqlInjectionRule",
            metricName: "SqlInjectionRule",
            predicates: [{
                dataId: sqlinj.ref,
                negated: false,
                type: "SqlInjectionMatch"
            }]
        });

        this.rules.push({
            action: {type: 'BLOCK'},
            priority: 1,
            ruleId: rule.ref,
        });
    }

    createWebAcl() {
        const webAcl = new CfnWebACL(this.stack, 'webAcl', {
            defaultAction: {
                type: 'ALLOW',
            },
            metricName: 'webAcl',
            name: 'webAcl',
            rules: this.rules
        });

        new CfnWebACLAssociation(this.stack, "webAcl-association", {
            resourceArn: this.props.loadBalancer.loadBalancerArn,
            webAclId: webAcl.ref
        });
    }
}