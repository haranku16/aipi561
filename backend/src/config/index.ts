import { DynamoDBClient } from "https://deno.land/x/aws_sdk@v3.32.0-1/client-dynamodb/mod.ts";

export const PORT = parseInt(Deno.env.get("PORT") || "8000");
export const AWS_REGION = Deno.env.get("AWS_REGION") || "us-east-1";
export const DYNAMODB_ENDPOINT = Deno.env.get("DYNAMODB_ENDPOINT");

export const dynamoClient = new DynamoDBClient({
  region: AWS_REGION,
  endpoint: DYNAMODB_ENDPOINT, // For local development
}); 