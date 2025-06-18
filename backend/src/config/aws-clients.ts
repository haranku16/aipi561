import { DynamoDBClient } from "@aws-sdk/client-dynamodb";
import { S3Client } from "@aws-sdk/client-s3";
import type { 
  PutItemCommandInput,
  QueryCommandInput,
  GetItemCommandInput,
  DeleteItemCommandInput,
  UpdateItemCommandInput,
  AttributeValue
} from "@aws-sdk/client-dynamodb";
import type { 
  PutObjectCommandInput,
  GetObjectCommandInput,
  DeleteObjectCommandInput
} from "@aws-sdk/client-s3";

// DynamoDB Client Interface - extends the actual AWS client
export interface IDynamoDBClient extends DynamoDBClient {}

// S3 Client Interface - extends the actual AWS client
export interface IS3Client extends S3Client {}

// Factory function to create AWS clients
export function createAWSClients(region: string): {
  dynamoClient: IDynamoDBClient;
  s3Client: IS3Client;
} {
  const awsConfig = {
    region,
    maxAttempts: 3,
  };
  
  return {
    dynamoClient: new DynamoDBClient(awsConfig),
    s3Client: new S3Client(awsConfig),
  };
}

// Export types for use in services
export type {
  PutItemCommandInput,
  QueryCommandInput,
  GetItemCommandInput,
  DeleteItemCommandInput,
  UpdateItemCommandInput,
  AttributeValue,
  PutObjectCommandInput,
  GetObjectCommandInput,
  DeleteObjectCommandInput,
}; 