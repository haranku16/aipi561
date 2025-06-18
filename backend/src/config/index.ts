import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import { STSClient, GetCallerIdentityCommand } from "@aws-sdk/client-sts";

export const PORT = parseInt(Deno.env.get("PORT") || "8000");
export const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";

// Debug: Log environment variables (without sensitive data)
console.log("AWS Configuration Debug:");
console.log("AWS_REGION:", AWS_REGION);
console.log("AWS_ACCESS_KEY_ID exists:", !!Deno.env.get("AWS_ACCESS_KEY_ID"));
console.log("AWS_SECRET_ACCESS_KEY exists:", !!Deno.env.get("AWS_SECRET_ACCESS_KEY"));
console.log("AWS_SESSION_TOKEN exists:", !!Deno.env.get("AWS_SESSION_TOKEN"));
console.log("AWS_WEB_IDENTITY_TOKEN_FILE exists:", !!Deno.env.get("AWS_WEB_IDENTITY_TOKEN_FILE"));
console.log("AWS_ROLE_ARN exists:", !!Deno.env.get("AWS_ROLE_ARN"));

// Additional debugging for AppRunner environment
console.log("Running on AppRunner:", !!Deno.env.get("AWS_EXECUTION_ENV"));
console.log("AWS_DEFAULT_REGION:", Deno.env.get("AWS_DEFAULT_REGION"));
console.log("AWS_REGION:", Deno.env.get("AWS_REGION"));

// Configure AWS clients with minimal configuration
// Let the SDK use its default credential resolution
const awsConfig = {
  region: AWS_REGION,
  // Don't specify credentials - let the SDK resolve them automatically
  // This should work with AppRunner's IAM role
  maxAttempts: 3, // Add retry configuration
};

export const dynamoClient = new DynamoDBClient(awsConfig);
export const s3Client = new S3Client(awsConfig);

// Test AWS credentials
export async function testAWSCredentials(): Promise<void> {
  try {
    const stsClient = new STSClient(awsConfig);
    const command = new GetCallerIdentityCommand({});
    const result = await stsClient.send(command);
    console.log("✅ AWS Credentials working! Account:", result.Account, "User/Role:", result.Arn);
  } catch (error) {
    console.error("❌ AWS Credentials test failed:", error);
    throw error;
  }
}
