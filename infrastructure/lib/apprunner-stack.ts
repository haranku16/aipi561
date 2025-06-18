import * as cdk from 'aws-cdk-lib';
import * as iam from 'aws-cdk-lib/aws-iam';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as dynamodb from 'aws-cdk-lib/aws-dynamodb';
import * as apprunner from '@aws-cdk/aws-apprunner-alpha';
import * as ecr_assets from 'aws-cdk-lib/aws-ecr-assets';
import { Construct } from 'constructs';

export interface AppRunnerStackProps extends cdk.StackProps {
  imageBucket: s3.Bucket;
  dynamoTable: dynamodb.Table;
  removalPolicy: cdk.RemovalPolicy;
}

export class AppRunnerStack extends cdk.Stack {
  public readonly service: apprunner.Service;

  constructor(scope: Construct, id: string, props: AppRunnerStackProps) {
    super(scope, id, props);

    // Create Docker image asset
    const image = new ecr_assets.DockerImageAsset(this, 'BackendImage', {
      directory: '../backend', // Path to the directory containing Dockerfile
    });

    // Create service instance role
    const serviceRole = new iam.Role(this, 'ServiceRole', {
      assumedBy: new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
      description: 'Service role for AIPI561 AppRunner service',
      managedPolicies: [
        iam.ManagedPolicy.fromAwsManagedPolicyName('service-role/AWSAppRunnerServicePolicyForECRAccess')
      ]
    });

    // Add trust relationship for AppRunner
    serviceRole.assumeRolePolicy?.addStatements(
      new iam.PolicyStatement({
        effect: iam.Effect.ALLOW,
        principals: [
          new iam.ServicePrincipal('tasks.apprunner.amazonaws.com'),
          new iam.ServicePrincipal('build.apprunner.amazonaws.com')
        ],
        actions: ['sts:AssumeRole']
      })
    );

    // Grant S3 access
    props.imageBucket.grantReadWrite(serviceRole);

    // Grant DynamoDB access
    props.dynamoTable.grantReadWriteData(serviceRole);

    // Add explicit STS permissions for credential verification
    serviceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'sts:GetCallerIdentity',
        'sts:AssumeRole'
      ],
      resources: ['*']
    }));

    // Add CloudWatch Logs permissions for better debugging
    serviceRole.addToPolicy(new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      actions: [
        'logs:CreateLogGroup',
        'logs:CreateLogStream',
        'logs:PutLogEvents',
        'logs:DescribeLogStreams'
      ],
      resources: ['*']
    }));

    // Create access role for ECR
    const accessRole = new iam.Role(this, 'AccessRole', {
      assumedBy: new iam.ServicePrincipal('build.apprunner.amazonaws.com'),
      description: 'Access role for AIPI561 AppRunner service to access ECR',
    });

    // Grant ECR pull access
    image.repository.grantPull(accessRole);

    const observabilityConfiguration = new apprunner.ObservabilityConfiguration(this, 'ObservabilityConfiguration', {
        observabilityConfigurationName: 'Aipi561Observability',
        traceConfigurationVendor: apprunner.TraceConfigurationVendor.AWSXRAY,
    });

    // Create AppRunner service
    this.service = new apprunner.Service(this, 'BackendService', {
      source: apprunner.Source.fromEcr({
        repository: image.repository,
        tag: image.imageTag,
        imageConfiguration: {
          port: 8000,
          environmentVariables: {
            NODE_ENV: 'production',
            GOOGLE_OAUTH_CLIENT_ID: process.env.GOOGLE_OAUTH_CLIENT_ID || '',
            OPENAI_API_KEY: process.env.OPENAI_API_KEY || '',
            S3_BUCKET: props.imageBucket.bucketName,
            DYNAMODB_TABLE: props.dynamoTable.tableName,
          },
        },
      }),
      instanceRole: serviceRole,
      cpu: apprunner.Cpu.ONE_VCPU,
      memory: apprunner.Memory.TWO_GB,
      autoDeploymentsEnabled: true,
      accessRole,
      observabilityConfiguration,
    });

    // Output the service URL
    new cdk.CfnOutput(this, 'ServiceUrl', {
      value: this.service.serviceUrl,
      description: 'The URL of the AppRunner service',
    });

    // Output the ECR repository URI
    new cdk.CfnOutput(this, 'RepositoryUri', {
      value: image.repository.repositoryUri,
      description: 'The URI of the ECR repository',
    });

    // Output the service role ARN for debugging
    new cdk.CfnOutput(this, 'ServiceRoleArn', {
      value: serviceRole.roleArn,
      description: 'The ARN of the AppRunner service role',
    });
  }
} 