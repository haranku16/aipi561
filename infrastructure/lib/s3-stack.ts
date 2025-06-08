import * as cdk from 'aws-cdk-lib';
import * as s3 from 'aws-cdk-lib/aws-s3';
import * as iam from 'aws-cdk-lib/aws-iam';
import { Construct } from 'constructs';

export interface S3StackProps extends cdk.StackProps {
  removalPolicy: cdk.RemovalPolicy;
}

export class S3Stack extends cdk.Stack {
  public readonly imageBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: S3StackProps) {
    super(scope, id, props);

    // Create S3 bucket for image uploads
    this.imageBucket = new s3.Bucket(this, 'ImageBucket', {
      bucketName: `aipi561-images-${this.account}-${this.region}`,
      removalPolicy: props.removalPolicy,
      autoDeleteObjects: props.removalPolicy === cdk.RemovalPolicy.DESTROY,
      versioned: true,
      cors: [
        {
          allowedMethods: [
            s3.HttpMethods.GET,
            s3.HttpMethods.PUT,
            s3.HttpMethods.POST,
            s3.HttpMethods.DELETE,
          ],
          allowedOrigins: ['*'], // TODO: Restrict this to your frontend domain in production
          allowedHeaders: ['*'],
          exposedHeaders: [
            'ETag',
            'x-amz-server-side-encryption',
            'x-amz-request-id',
            'x-amz-id-2',
          ],
          maxAge: 3000,
        },
      ],
      lifecycleRules: [
        {
          // Keep only the current version of images
          noncurrentVersionExpiration: cdk.Duration.days(30),
          // Delete incomplete multipart uploads after 7 days
          abortIncompleteMultipartUploadAfter: cdk.Duration.days(7),
        },
      ],
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      enforceSSL: true,
    });

    // Add bucket policy to allow CloudFront access (if needed later)
    const bucketPolicy = new iam.PolicyStatement({
      effect: iam.Effect.ALLOW,
      principals: [new iam.ServicePrincipal('cloudfront.amazonaws.com')],
      actions: ['s3:GetObject'],
      resources: [this.imageBucket.arnForObjects('*')],
    });

    // Output the bucket name and ARN
    new cdk.CfnOutput(this, 'ImageBucketName', {
      value: this.imageBucket.bucketName,
      description: 'The name of the S3 bucket for image uploads',
    });

    new cdk.CfnOutput(this, 'ImageBucketArn', {
      value: this.imageBucket.bucketArn,
      description: 'The ARN of the S3 bucket for image uploads',
    });
  }
} 