#!/usr/bin/env node
import 'source-map-support/register';
import * as cdk from 'aws-cdk-lib';
import { DynamoDBStack } from '../lib/dynamodb-stack';
import { S3Stack } from '../lib/s3-stack';
import { AppRunnerStack } from '../lib/apprunner-stack';

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

// Create S3 stack
const s3Stack = new S3Stack(app, `Aipi561S3-${env}`, {
  env: envConfig.env,
  removalPolicy: env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
});

// Create AppRunner stack
const appRunnerStack = new AppRunnerStack(app, `Aipi561AppRunner-${env}`, {
  env: envConfig.env,
  removalPolicy: env === 'prod' ? cdk.RemovalPolicy.RETAIN : cdk.RemovalPolicy.DESTROY,
  imageBucket: s3Stack.imageBucket,
  dynamoTable: dynamoStack.table,
});
appRunnerStack.addDependency(dynamoStack);
appRunnerStack.addDependency(s3Stack);

// Add tags to all resources
cdk.Tags.of(app).add('Project', 'AIPI561');
cdk.Tags.of(app).add('Environment', env);

app.synth(); 