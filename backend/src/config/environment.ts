export interface EnvironmentConfig {
  // AWS Configuration
  awsRegion: string;
  port: number;
  
  // DynamoDB Configuration
  dynamodbTable: string;
  
  // S3 Configuration
  s3Bucket: string;
  
  // OpenAI Configuration
  openaiApiKey: string;
  
  // Google OAuth Configuration
  googleOauthClientId: string;
}

export function createEnvironmentConfig(): EnvironmentConfig {
  const dynamodbTable = Deno.env.get("DYNAMODB_TABLE");
  const s3Bucket = Deno.env.get("S3_BUCKET");
  const openaiApiKey = Deno.env.get("OPENAI_API_KEY");
  const googleOauthClientId = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
  
  if (!dynamodbTable) {
    throw new Error("DYNAMODB_TABLE environment variable is required");
  }
  
  if (!s3Bucket) {
    throw new Error("S3_BUCKET environment variable is required");
  }
  
  if (!openaiApiKey) {
    throw new Error("OPENAI_API_KEY environment variable is required");
  }
  
  if (!googleOauthClientId) {
    throw new Error("GOOGLE_OAUTH_CLIENT_ID environment variable is required");
  }
  
  return {
    awsRegion: Deno.env.get("AWS_REGION") || "us-east-1",
    port: parseInt(Deno.env.get("PORT") || "8000"),
    dynamodbTable,
    s3Bucket,
    openaiApiKey,
    googleOauthClientId,
  };
} 