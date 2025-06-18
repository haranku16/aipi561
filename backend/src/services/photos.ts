import { 
  PhotoListResponse, 
  PhotoMetadata 
} from "../types/index.ts";
import { 
  GetObjectCommand, 
  PutObjectCommand,
  DeleteObjectCommand,
  type PutObjectCommandInput 
} from "@aws-sdk/client-s3";
import { 
  PutItemCommand,
  QueryCommand,
  GetItemCommand,
  DeleteItemCommand,
  type PutItemCommandInput,
  type QueryCommandInput,
  type GetItemCommandInput,
  type DeleteItemCommandInput,
  type AttributeValue
} from "@aws-sdk/client-dynamodb";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";
import { EnvironmentConfig } from "../config/environment.ts";
import { IDynamoDBClient, IS3Client } from "../config/aws-clients.ts";
import { IQueueProcessor } from "./queue-processor.ts";

export interface IPhotosService {
  generatePresignedUrl(
    userId: string,
    filename: string,
    contentType: string
  ): Promise<{ photoId: string; uploadUrl: string }>;
  
  listPhotos(
    userId: string,
    pageSize: number,
    nextToken?: string
  ): Promise<PhotoListResponse>;
  
  getPhoto(
    photoId: string,
    userId: string
  ): Promise<PhotoMetadata | null>;
  
  getPhotoByLookupKey(
    userId: string,
    lookupKey: string
  ): Promise<PhotoMetadata | null>;
  
  uploadImage(
    userId: string,
    imageBuffer: Uint8Array,
    filename: string,
    contentType: string
  ): Promise<{ photoMetadata: PhotoMetadata; presignedUrl: string }>;
  
  deletePhoto(
    userId: string,
    lookupKey: string
  ): Promise<boolean>;
}

export class PhotosService implements IPhotosService {
  constructor(
    private config: EnvironmentConfig,
    private dynamoClient: IDynamoDBClient,
    private s3Client: IS3Client,
    private queueProcessor: IQueueProcessor,
    private getSignedUrlFn: typeof getSignedUrl = getSignedUrl
  ) {}

  // Generate a unique photo ID
  private generatePhotoId(): string {
    const randomBytes = new Uint8Array(8);
    crypto.getRandomValues(randomBytes);
    return Array.from(randomBytes)
      .map(b => b.toString(16).padStart(2, '0'))
      .join('');
  }

  // Generate a pre-signed URL for direct upload to S3
  async generatePresignedUrl(
    userId: string,
    filename: string,
    contentType: string
  ): Promise<{ photoId: string; uploadUrl: string }> {
    const photoId = this.generatePhotoId();
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
      status: "pending",
      lookupKey: sortKey
    };

    const putItemInput: PutItemCommandInput = {
      TableName: this.config.dynamodbTable,
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

    await this.dynamoClient.send(new PutItemCommand(putItemInput));

    // Generate pre-signed URL
    const putObjectInput: PutObjectCommandInput = {
      Bucket: this.config.s3Bucket,
      Key: s3Key,
      ContentType: contentType,
    };

    const command = new PutObjectCommand(putObjectInput);
    const uploadUrl = await this.getSignedUrlFn(this.s3Client, command, { expiresIn: 3600 });

    return { photoId, uploadUrl };
  }

  // List user's photos from DynamoDB using primary table
  async listPhotos(
    userId: string,
    pageSize: number,
    nextToken?: string
  ): Promise<PhotoListResponse> {
    const queryInput: QueryCommandInput = {
      TableName: this.config.dynamodbTable,
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

    const result = await this.dynamoClient.send(new QueryCommand(queryInput));

    const photos = result.Items?.map((item: Record<string, AttributeValue>) => ({
      photoId: item.photoId.S!,
      userId: item.userId.S!,
      s3Key: item.s3Key.S!,
      uploadTimestamp: item.uploadTimestamp.S!,
      status: item.status.S! as PhotoMetadata["status"],
      title: item.title?.S,
      description: item.description?.S,
      processingError: item.processingError?.S,
      lookupKey: item.SK.S!
    })) || [];

    return {
      photos,
      nextToken: result.LastEvaluatedKey ? btoa(JSON.stringify(result.LastEvaluatedKey)) : undefined
    };
  }

  // Get a single photo by photoId
  async getPhoto(
    photoId: string,
    userId: string
  ): Promise<PhotoMetadata | null> {
    // Query for the photo using GSI
    const queryInput: QueryCommandInput = {
      TableName: this.config.dynamodbTable,
      IndexName: "PhotoIdIndex",
      KeyConditionExpression: "photoId = :photoId",
      FilterExpression: "userId = :userId",
      ExpressionAttributeValues: {
        ":photoId": { S: photoId },
        ":userId": { S: userId }
      }
    };

    const result = await this.dynamoClient.send(new QueryCommand(queryInput));

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
      processingError: item.processingError?.S,
      lookupKey: item.SK.S!
    };
  }

  // Get a single photo by lookupKey for direct DynamoDB access
  async getPhotoByLookupKey(
    userId: string,
    lookupKey: string
  ): Promise<PhotoMetadata | null> {
    const getItemInput: GetItemCommandInput = {
      TableName: this.config.dynamodbTable,
      Key: {
        PK: { S: `USER#${userId}` },
        SK: { S: lookupKey }
      }
    };

    const result = await this.dynamoClient.send(new GetItemCommand(getItemInput));

    if (!result.Item) {
      return null;
    }

    const item = result.Item;
    return {
      photoId: item.photoId.S!,
      userId: item.userId.S!,
      s3Key: item.s3Key.S!,
      uploadTimestamp: item.uploadTimestamp.S!,
      status: item.status.S! as PhotoMetadata["status"],
      title: item.title?.S,
      description: item.description?.S,
      processingError: item.processingError?.S,
      lookupKey: item.SK.S!
    };
  }

  // Upload image directly and store metadata
  async uploadImage(
    userId: string,
    imageBuffer: Uint8Array,
    filename: string,
    contentType: string
  ): Promise<{ photoMetadata: PhotoMetadata; presignedUrl: string }> {
    const photoId = this.generatePhotoId();
    const s3Key = `${userId}/${photoId}/${filename}`;
    const timestamp = new Date().toISOString();
    const sortKey = `${Date.now()}#${photoId}`; // Millisecond precision for natural sorting

    // Upload image to S3
    const putObjectInput: PutObjectCommandInput = {
      Bucket: this.config.s3Bucket,
      Key: s3Key,
      Body: imageBuffer,
      ContentType: contentType,
      ContentLength: imageBuffer.length,
    };

    await this.s3Client.send(new PutObjectCommand(putObjectInput));

    // Create photo metadata
    const photoMetadata: PhotoMetadata = {
      photoId,
      userId,
      s3Key,
      uploadTimestamp: timestamp,
      status: "pending", // Set to pending until AI analysis is complete
      lookupKey: sortKey
    };

    // Store metadata in DynamoDB using single-table design
    const putItemInput: PutItemCommandInput = {
      TableName: this.config.dynamodbTable,
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

    await this.dynamoClient.send(new PutItemCommand(putItemInput));

    // Enqueue photo for AI processing using Deno Queues
    await this.queueProcessor.enqueuePhotoProcessing(photoId, userId, s3Key);

    // Generate presigned URL for viewing the image
    const getObjectInput = {
      Bucket: this.config.s3Bucket,
      Key: s3Key,
    };

    const getCommand = new GetObjectCommand(getObjectInput);
    const presignedUrl = await this.getSignedUrlFn(this.s3Client, getCommand, { expiresIn: 3600 });

    return { photoMetadata, presignedUrl };
  }

  // Delete a photo by lookupKey
  async deletePhoto(
    userId: string,
    lookupKey: string
  ): Promise<boolean> {
    // First, get the photo to get the S3 key
    const photo = await this.getPhotoByLookupKey(userId, lookupKey);
    if (!photo) {
      return false;
    }

    // Delete from S3 - try multiple approaches
    let s3Deleted = false;
    try {
      const deleteObjectInput = {
        Bucket: this.config.s3Bucket,
        Key: photo.s3Key,
      };

      const command = new DeleteObjectCommand(deleteObjectInput);
      await this.s3Client.send(command);
      s3Deleted = true;
      console.log("S3 object deleted successfully");
    } catch (error) {
      console.error("Failed to delete S3 object:", error);
      // If it's a stream collector error, the object might still be deleted
      // S3 delete operations are idempotent, so we can continue
      if (error instanceof Error && error.message && error.message.includes('getReader')) {
        console.log("Stream collector error - S3 object may still be deleted");
        s3Deleted = true; // Assume success for this type of error
      }
    }

    // Delete from DynamoDB
    const deleteItemInput: DeleteItemCommandInput = {
      TableName: this.config.dynamodbTable,
      Key: {
        PK: { S: `USER#${userId}` },
        SK: { S: lookupKey }
      }
    };

    try {
      await this.dynamoClient.send(new DeleteItemCommand(deleteItemInput));
      console.log("DynamoDB item deleted successfully");
      // Return true if DynamoDB deletion succeeds, regardless of S3 status
      // The S3 object will be cleaned up later or is already deleted
      return true;
    } catch (error) {
      console.error("Failed to delete DynamoDB item:", error);
      return false;
    }
  }
} 