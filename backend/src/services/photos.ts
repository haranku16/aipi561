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
const DYNAMODB_TABLE = Deno.env.get("DYNAMODB_TABLE");

if (!S3_BUCKET || !DYNAMODB_TABLE) {
  throw new Error("Required environment variables are missing");
}

const s3Client = new S3Client({
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

  // Create DynamoDB record using single-table design
  // PK: USER#userId, SK: timestamp#photoId
  const timestamp = new Date().toISOString();
  const sortKey = `${Date.now()}#${photoId}`; // Millisecond precision for natural sorting

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
      PK: { S: `USER#${userId}` },
      SK: { S: sortKey },
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

// List user's photos from DynamoDB using primary table
export async function listPhotos(
  userId: string,
  pageSize: number,
  nextToken?: string
): Promise<PhotoListResponse> {
  const queryInput: QueryCommandInput = {
    TableName: DYNAMODB_TABLE,
    KeyConditionExpression: "PK = :pk",
    ExpressionAttributeValues: {
      ":pk": { S: `USER#${userId}` }
    },
    ScanIndexForward: false, // Sort by SK descending (newest first)
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
    title: item.title?.S,
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
  // TODO: Fix OpenSearch client usage
  // For now, return empty results
  return {
    results: [],
    nextToken: undefined
  };
  
  /*
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

  const response = await opensearchClient.send(new SearchCommand({
    index: "photos",
    body: searchBody
  }));

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
  */
}

// Get a single photo by photoId and userId
export async function getPhoto(
  photoId: string,
  userId: string
): Promise<PhotoMetadata | null> {
  // Since we don't have a direct way to query by photoId, we'll need to scan
  // This is not ideal for large datasets, but for now it works
  // In a production environment, you might want to add a secondary index for photoId lookups
  // or use a different key structure if photoId lookups are frequent
  
  const queryInput: QueryCommandInput = {
    TableName: DYNAMODB_TABLE,
    KeyConditionExpression: "PK = :pk",
    FilterExpression: "photoId = :photoId",
    ExpressionAttributeValues: {
      ":pk": { S: `USER#${userId}` },
      ":photoId": { S: photoId }
    }
  };

  const result = await dynamoClient.send(new QueryCommand(queryInput));

  if (!result.Items || result.Items.length === 0) {
    return null;
  }

  const item = result.Items[0];
  return {
    photoId: item.photoId.S!,
    userId: item.userId.S!,
    s3Key: item.s3Key.S!,
    uploadTimestamp: item.uploadTimestamp.S!,
    status: item.status.S! as PhotoMetadata["status"],
    title: item.title?.S,
    description: item.description?.S,
    processingError: item.processingError?.S
  };
}

// Upload image directly and store metadata
export async function uploadImage(
  userId: string,
  imageBuffer: Uint8Array,
  filename: string,
  contentType: string
): Promise<{ photoMetadata: PhotoMetadata; presignedUrl: string }> {
  const photoId = generatePhotoId();
  const s3Key = `${userId}/${photoId}/${filename}`;
  const timestamp = new Date().toISOString();
  const sortKey = `${Date.now()}#${photoId}`; // Millisecond precision for natural sorting

  // Upload image to S3
  const putObjectInput: PutObjectCommandInput = {
    Bucket: S3_BUCKET,
    Key: s3Key,
    Body: imageBuffer,
    ContentType: contentType,
    ContentLength: imageBuffer.length,
  };

  await s3Client.send(new PutObjectCommand(putObjectInput));

  // Create photo metadata
  const photoMetadata: PhotoMetadata = {
    photoId,
    userId,
    s3Key,
    uploadTimestamp: timestamp,
    status: "pending" // Set to pending until AI analysis is complete
  };

  // Store metadata in DynamoDB using single-table design
  const putItemInput: PutItemCommandInput = {
    TableName: DYNAMODB_TABLE,
    Item: {
      PK: { S: `USER#${userId}` },
      SK: { S: sortKey },
      photoId: { S: photoId },
      userId: { S: userId },
      s3Key: { S: s3Key },
      uploadTimestamp: { S: timestamp },
      status: { S: "pending" }
    }
  };

  await dynamoClient.send(new PutItemCommand(putItemInput));

  // Generate presigned URL for viewing the image
  const getObjectInput = {
    Bucket: S3_BUCKET,
    Key: s3Key,
  };

  const getCommand = new GetObjectCommand(getObjectInput);
  const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

  return { photoMetadata, presignedUrl };
} 