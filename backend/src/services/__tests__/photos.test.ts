import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { PhotosService } from "../photos.ts";
import { EnvironmentConfig } from "../../config/environment.ts";
import { IDynamoDBClient, IS3Client } from "../../config/aws-clients.ts";
import { IQueueProcessor } from "../queue-processor.ts";
import { PutItemCommand, QueryCommand, GetItemCommand, DeleteItemCommand } from "@aws-sdk/client-dynamodb";
import { PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from "@aws-sdk/client-s3";

// Mock implementations for testing
class MockDynamoDBClient {
  public send = async <T>(command: any): Promise<T> => {
    if (command.constructor.name === "PutItemCommand") {
      return {} as T;
    } else if (command.constructor.name === "QueryCommand") {
      // Mock query results for listPhotos test
      if (command.input.KeyConditionExpression === "PK = :pk") {
        return {
          Items: [
            {
              PK: { S: "USER#test@example.com" },
              SK: { S: "1704070800000#photo-1" },
              photoId: { S: "photo-1" },
              userId: { S: "test@example.com" },
              s3Key: { S: "test@example.com/photo-1/test.jpg" },
              uploadTimestamp: { S: "2024-01-01T00:00:00.000Z" },
              status: { S: "completed" }
            },
            {
              PK: { S: "USER#test@example.com" },
              SK: { S: "1704070800000#photo-2" },
              photoId: { S: "photo-2" },
              userId: { S: "test@example.com" },
              s3Key: { S: "test@example.com/photo-2/test2.jpg" },
              uploadTimestamp: { S: "2024-01-01T00:00:00.000Z" },
              status: { S: "pending" }
            }
          ],
          LastEvaluatedKey: {
            PK: { S: "USER#test@example.com" },
            SK: { S: "1704070800000#photo-2" }
          }
        } as T;
      }
      return { Items: [] } as T;
    } else if (command.constructor.name === "GetItemCommand") {
      // Mock get item results
      if (command.input.Key.SK.S === "test-lookup-key") {
        return {
          Item: {
            PK: { S: "USER#test@example.com" },
            SK: { S: "test-lookup-key" },
            photoId: { S: "test-photo-id" },
            userId: { S: "test@example.com" },
            s3Key: { S: "test@example.com/test-photo-id/test.jpg" },
            uploadTimestamp: { S: "2024-01-01T00:00:00.000Z" },
            status: { S: "completed" }
          }
        } as T;
      }
      return {} as T;
    } else if (command.constructor.name === "DeleteItemCommand") {
      return {} as T;
    }
    return {} as T;
  };
}

class MockS3Client {
  public endpointProvider = () => {};
  public send = async <T>(_command: any): Promise<T> => {
    return {} as T;
  };
}

class MockQueueProcessor implements IQueueProcessor {
  public enqueuePhotoProcessing = async (photoId: string, userId: string, s3Key: string): Promise<void> => {
    // Mock implementation
  };
  
  public initializeQueue = async (): Promise<void> => {};
  public setupQueueListener = async (): Promise<void> => {};
}

// Mock getSignedUrl function
const mockGetSignedUrl = async () => "https://dummy-presigned-url";

// Test configuration
const mockConfig: EnvironmentConfig = {
  awsRegion: "us-east-1",
  port: 8000,
  dynamodbTable: "test-table",
  s3Bucket: "test-bucket",
  openaiApiKey: "test-key",
  googleOauthClientId: "test-client-id",
};

Deno.test("PhotosService - generatePresignedUrl", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.generatePresignedUrl(
    "test@example.com",
    "test.jpg",
    "image/jpeg"
  );
  
  assertEquals(typeof result.photoId, "string");
  assertEquals(result.photoId.length, 16); // 8 bytes = 16 hex chars
  assertEquals(typeof result.uploadUrl, "string");
  assertEquals(result.uploadUrl, "https://dummy-presigned-url");
});

Deno.test("PhotosService - listPhotos", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.listPhotos("test@example.com", 10);
  
  assertEquals(result.photos.length, 2);
  assertEquals(result.photos[0].photoId, "photo-1");
  assertEquals(result.photos[1].photoId, "photo-2");
  assertEquals(result.photos[0].status, "completed");
  assertEquals(result.photos[1].status, "pending");
  assertEquals(typeof result.nextToken, "string");
  assertEquals(result.nextToken, "eyJQSyI6eyJTIjoiVVNFUiN0ZXN0QGV4YW1wbGUuY29tIn0sIlNLIjp7IlMiOiIxNzA0MDcwODAwMDAwI3Bob3RvLTIifX0=");
});

Deno.test("PhotosService - listPhotos with nextToken", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const nextToken = "eyJQSyI6eyJTIjoiVVNFUiN0ZXN0QGV4YW1wbGUuY29tIn0sIlNLIjp7IlMiOiIxNzA0MDcwODAwMDAwI3Bob3RvLTIifX0=";
  const result = await photosService.listPhotos("test@example.com", 10, nextToken);
  
  assertEquals(result.photos.length, 2);
  assertEquals(typeof result.nextToken, "string");
});

Deno.test("PhotosService - listPhotos with empty results", async () => {
  const mockDynamoClient = {
    send: async <T>(_command: any): Promise<T> => {
      return { Items: [] } as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.listPhotos("test@example.com", 10);
  
  assertEquals(result.photos.length, 0);
  assertEquals(result.nextToken, undefined);
});

Deno.test("PhotosService - listPhotos with null Items", async () => {
  const mockDynamoClient = {
    send: async <T>(_command: any): Promise<T> => {
      return { Items: null } as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.listPhotos("test@example.com", 10);
  
  assertEquals(result.photos.length, 0);
  assertEquals(result.nextToken, undefined);
});

Deno.test("PhotosService - listPhotos with null LastEvaluatedKey", async () => {
  const mockDynamoClient = {
    send: async <T>(_command: any): Promise<T> => {
      return { 
        Items: [
          {
            PK: { S: "USER#test@example.com" },
            SK: { S: "1704070800000#photo-1" },
            photoId: { S: "photo-1" },
            userId: { S: "test@example.com" },
            s3Key: { S: "test@example.com/photo-1/test.jpg" },
            uploadTimestamp: { S: "2024-01-01T00:00:00.000Z" },
            status: { S: "completed" }
          }
        ],
        LastEvaluatedKey: null
      } as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.listPhotos("test@example.com", 10);
  
  assertEquals(result.photos.length, 1);
  assertEquals(result.nextToken, undefined);
});

Deno.test("PhotosService - getPhoto", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.getPhoto("test-photo-id", "test@example.com");
  
  assertEquals(result, null); // Mock returns empty items for this query
});

Deno.test("PhotosService - getPhoto with empty Items", async () => {
  const mockDynamoClient = {
    send: async <T>(_command: any): Promise<T> => {
      return { Items: [] } as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.getPhoto("test-photo-id", "test@example.com");
  
  assertEquals(result, null);
});

Deno.test("PhotosService - getPhoto with null Items", async () => {
  const mockDynamoClient = {
    send: async <T>(_command: any): Promise<T> => {
      return { Items: null } as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.getPhoto("test-photo-id", "test@example.com");
  
  assertEquals(result, null);
});

Deno.test("PhotosService - getPhotoByLookupKey", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.getPhotoByLookupKey("test@example.com", "test-lookup-key");
  
  assertEquals(result?.photoId, "test-photo-id");
  assertEquals(result?.userId, "test@example.com");
  assertEquals(result?.status, "completed");
});

Deno.test("PhotosService - getPhotoByLookupKey with optional fields", async () => {
  const mockDynamoClient = {
    send: async <T>(_command: any): Promise<T> => {
      return {
        Item: {
          PK: { S: "USER#test@example.com" },
          SK: { S: "test-lookup-key" },
          photoId: { S: "test-photo-id" },
          userId: { S: "test@example.com" },
          s3Key: { S: "test@example.com/test-photo-id/test.jpg" },
          uploadTimestamp: { S: "2024-01-01T00:00:00.000Z" },
          status: { S: "completed" },
          title: { S: "Test Title" },
          description: { S: "Test Description" },
          processingError: { S: "Test Error" }
        }
      } as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.getPhotoByLookupKey("test@example.com", "test-lookup-key");
  
  assertEquals(result?.photoId, "test-photo-id");
  assertEquals(result?.title, "Test Title");
  assertEquals(result?.description, "Test Description");
  assertEquals(result?.processingError, "Test Error");
});

Deno.test("PhotosService - getPhotoByLookupKey not found", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.getPhotoByLookupKey("test@example.com", "non-existent-key");
  
  assertEquals(result, null);
});

Deno.test("PhotosService - uploadImage", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const imageBuffer = new Uint8Array([255, 216, 255, 224]); // JPEG header
  const result = await photosService.uploadImage(
    "test@example.com",
    imageBuffer,
    "test.jpg",
    "image/jpeg"
  );
  
  assertEquals(typeof result.photoMetadata.photoId, "string");
  assertEquals(result.photoMetadata.photoId.length, 16);
  assertEquals(result.photoMetadata.userId, "test@example.com");
  assertEquals(result.photoMetadata.status, "pending");
  assertEquals(typeof result.presignedUrl, "string");
  assertEquals(result.presignedUrl, "https://dummy-presigned-url");
});

Deno.test("PhotosService - deletePhoto success", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.deletePhoto("test@example.com", "test-lookup-key");
  
  assertEquals(result, true);
});

Deno.test("PhotosService - deletePhoto not found", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.deletePhoto("test@example.com", "non-existent-key");
  
  assertEquals(result, false);
});

Deno.test("PhotosService - deletePhoto with S3 error", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = {
    endpointProvider: () => {},
    send: async <T>(_command: any): Promise<T> => {
      throw new Error("S3 error");
    }
  } as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.deletePhoto("test@example.com", "test-lookup-key");
  
  assertEquals(result, true); // Should still return true as DynamoDB deletion succeeds
});

Deno.test("PhotosService - deletePhoto with S3 stream collector error", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = {
    endpointProvider: () => {},
    send: async <T>(_command: any): Promise<T> => {
      throw new Error("getReader error");
    }
  } as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.deletePhoto("test@example.com", "test-lookup-key");
  
  assertEquals(result, true); // Should still return true as DynamoDB deletion succeeds
});

Deno.test("PhotosService - deletePhoto with DynamoDB error", async () => {
  const mockDynamoClient = {
    send: async <T>(command: any): Promise<T> => {
      if (command.constructor.name === "DeleteItemCommand") {
        throw new Error("DynamoDB error");
      }
      // For other commands, return the default mock behavior
      if (command.constructor.name === "GetItemCommand") {
        return {
          Item: {
            PK: { S: "USER#test@example.com" },
            SK: { S: "test-lookup-key" },
            photoId: { S: "test-photo-id" },
            userId: { S: "test@example.com" },
            s3Key: { S: "test@example.com/test-photo-id/test.jpg" },
            uploadTimestamp: { S: "2024-01-01T00:00:00.000Z" },
            status: { S: "completed" }
          }
        } as T;
      }
      return {} as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result = await photosService.deletePhoto("test@example.com", "test-lookup-key");
  
  assertEquals(result, false); // Should return false when DynamoDB deletion fails
});

Deno.test("PhotosService - generatePhotoId uniqueness", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  const result1 = await photosService.generatePresignedUrl("test@example.com", "test1.jpg", "image/jpeg");
  const result2 = await photosService.generatePresignedUrl("test@example.com", "test2.jpg", "image/jpeg");
  
  assertEquals(result1.photoId !== result2.photoId, true);
  assertEquals(result1.photoId.length, 16);
  assertEquals(result2.photoId.length, 16);
});

Deno.test("PhotosService - constructor with dependencies", () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as unknown as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor,
    mockGetSignedUrl
  );
  
  assertEquals(photosService instanceof PhotosService, true);
}); 