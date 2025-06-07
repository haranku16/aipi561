#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DynamoDBStack } from '../lib/dynamodb-stack';

const app = new cdk.App();

// Get environment from context or default to 'dev'
const env = app.node.tryGetContext('env') as string || 'dev';

interface EnvConfig {
  env: { account: string | undefined; region: string };
}

const envConfigs: Record<string, EnvConfig> = {
  dev: {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  },
  prod: {
    env: { account: process.env.CDK_DEFAULT_ACCOUNT, region: 'us-east-1' },
  },
};

const envConfig = envConfigs[env];
if (!envConfig) {
  throw new Error(`Invalid environment: ${env}`);
}

// Create DynamoDB stack
const dynamoStack = new DynamoDBStack(app, `Aipi561DynamoDB-${env}`, {
  env: envConfig.env,
  removalPolicy: env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
});

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'AIPI561');
cdk.Tags.of(app).add('Environment', env);

app.synth(); 