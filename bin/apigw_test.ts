#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { ApigwTestStack } from '../lib/apigw_test-stack';

const app = new cdk.App();

new ApigwTestStack(app, 'ApigwTestStack', {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  },
});
