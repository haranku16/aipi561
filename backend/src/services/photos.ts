import { 
  PhotoListResponse, 
  PhotoSearchRequest, 
  PhotoSearchResponse,
  PhotoMetadata 
} from "../types/index.ts";
import { dynamoClient } from "../config/index.ts";
import { 
  S3Client, 
  GetObjectCommand, 
  PutObjectCommand,
  type PutObjectCommandInput 
} from "https://deno.land/x/aws_sdk@v3.32.0-1/client-s3/mod.ts";
import { 
  OpenSearchClient
} from "https://deno.land/x/aws_sdk@v3.32.0-1/client-opensearch/mod.ts";
import { 
  DynamoDBClient,
  PutItemCommand,
  QueryCommand,
  type PutItemCommandInput,
  type QueryCommandInput,
  type AttributeValue
} from "https://deno.land/x/aws_sdk@v3.32.0-1/client-dynamodb/mod.ts";
import { getSignedUrl } from "https://deno.land/x/aws_sdk@v3.32.0-1/s3-request-presigner/mod.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const S3_BUCKET = Deno.env.get("S3_BUCKET");
const OPENSEARCH_DOMAIN = Deno.env.get("OPENSEARCH_DOMAIN");
const DYNAMODB_TABLE = Deno.env.get("DYNAMODB_TABLE");

if (!S3_BUCKET || !OPENSEARCH_DOMAIN || !DYNAMODB_TABLE) {
  throw new Error("Required environment variables are missing");
}

const s3Client = new S3Client({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
});

const opensearchClient = new OpenSearchClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
});

// Generate a unique photo ID
function generatePhotoId(): string {
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate a pre-signed URL for direct upload to S3
export async function generatePresignedUrl(
  userId: string,
  filename: string,
  contentType: string
): Promise<{ photoId: string; uploadUrl: string }> {
  const photoId = generatePhotoId();
  const s3Key = `${userId}/${photoId}/${filename}`;

  // Create DynamoDB record
  const timestamp = new Date().toISOString();
  const photoMetadata: PhotoMetadata = {
    photoId,
    userId,
    s3Key,
    uploadTimestamp: timestamp,
    status: "pending"
  };

  const putItemInput: PutItemCommandInput = {
    TableName: DYNAMODB_TABLE,
    Item: {
      photoId: { S: photoId },
      userId: { S: userId },
      s3Key: { S: s3Key },
      uploadTimestamp: { S: timestamp },
      status: { S: "pending" }
    }
  };

  await dynamoClient.send(new PutItemCommand(putItemInput));

  // Generate pre-signed URL
  const putObjectInput: PutObjectCommandInput = {
    Bucket: S3_BUCKET,
    Key: s3Key,
    ContentType: contentType,
  };

  const command = new PutObjectCommand(putObjectInput);
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 3600 });

  return { photoId, uploadUrl };
}

// List user's photos from DynamoDB
export async function listPhotos(
  userId: string,
  pageSize: number,
  nextToken?: string
): Promise<PhotoListResponse> {
  const queryInput: QueryCommandInput = {
    TableName: DYNAMODB_TABLE,
    KeyConditionExpression: "userId = :userId",
    ExpressionAttributeValues: {
      ":userId": { S: userId }
    },
    Limit: pageSize
  };

  if (nextToken) {
    queryInput.ExclusiveStartKey = JSON.parse(atob(nextToken)) as Record<string, AttributeValue>;
  }

  const result = await dynamoClient.send(new QueryCommand(queryInput));

  const photos = result.Items?.map((item: Record<string, AttributeValue>) => ({
    photoId: item.photoId.S!,
    userId: item.userId.S!,
    s3Key: item.s3Key.S!,
    uploadTimestamp: item.uploadTimestamp.S!,
    status: item.status.S! as PhotoMetadata["status"],
    description: item.description?.S,
    processingError: item.processingError?.S
  })) || [];

  return {
    photos,
    nextToken: result.LastEvaluatedKey ? btoa(JSON.stringify(result.LastEvaluatedKey)) : undefined
  };
}

// Search photos using OpenSearch
export async function searchPhotos(
  userId: string,
  request: PhotoSearchRequest
): Promise<PhotoSearchResponse> {
  const pageSize = request.pageSize || 20;
  const from = request.nextToken ? parseInt(atob(request.nextToken)) : 0;

  // Define the search request body type
  type SearchRequestBody = {
    query: {
      bool: {
        must: Array<{
          term?: { [key: string]: string };
          multi_match?: {
            query: string;
            fields: string[];
            type: string;
            fuzziness: string;
          };
        }>;
      };
    };
    size: number;
    from: number;
  };

  const searchBody: SearchRequestBody = {
    query: {
      bool: {
        must: [
          { term: { userId } },
          {
            multi_match: {
              query: request.query,
              fields: ["description^2", "filename"],
              type: "best_fields",
              fuzziness: "AUTO"
            }
          }
        ]
      }
    },
    size: pageSize,
    from
  };

  const response = await opensearchClient.send({
    index: "photos",
    body: searchBody
  });

  // Type assertion for the response
  type SearchHit = {
    _source: PhotoMetadata;
    _score: number;
  };

  const hits = (response as any).hits?.hits as SearchHit[] || [];
  const results = hits.map(hit => ({
    ...hit._source,
    score: hit._score
  }));

  return {
    results,
    nextToken: hits.length === pageSize 
      ? btoa(String(from + pageSize))
      : undefined
  };
} 