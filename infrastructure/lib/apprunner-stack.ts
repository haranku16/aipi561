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
    });

    // Grant S3 access
    props.imageBucket.grantReadWrite(serviceRole);

    // Grant DynamoDB access
    props.dynamoTable.grantReadWriteData(serviceRole);

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
  }
} 