# Backend Architecture - Object-Oriented Design

This document describes the refactored backend architecture that follows object-oriented programming principles and is designed for better testability.

## Overview

The backend has been refactored from a functional approach to an object-oriented approach with dependency injection. This makes the code more testable, maintainable, and follows SOLID principles.

## Key Components

### 1. Environment Configuration (`src/config/environment.ts`)

Centralizes all environment variables into a single configuration object:

```typescript
export interface EnvironmentConfig {
  awsRegion: string;
  port: number;
  dynamodbTable: string;
  s3Bucket: string;
  openaiApiKey: string;
  googleOauthClientId: string;
}
```

### 2. AWS Client Interfaces (`src/config/aws-clients.ts`)

Provides interfaces for AWS clients to enable mocking in tests:

```typescript
export interface IDynamoDBClient extends DynamoDBClient {}
export interface IS3Client extends S3Client {}
```

### 3. Service Classes

All services are now classes that accept their dependencies through constructor injection:

#### AuthService (`src/services/auth.ts`)
```typescript
export class AuthService implements IAuthService {
  constructor(private config: EnvironmentConfig) {}
  
  async verifyGoogleToken(token: string): Promise<UserInfo> {
    // Implementation
  }
}
```

#### PhotosService (`src/services/photos.ts`)
```typescript
export class PhotosService implements IPhotosService {
  constructor(
    private config: EnvironmentConfig,
    private dynamoClient: IDynamoDBClient,
    private s3Client: IS3Client,
    private queueProcessor: IQueueProcessor
  ) {}
  
  // Methods for photo operations
}
```

#### QueueProcessor (`src/services/queue-processor.ts`)
```typescript
export class QueueProcessor implements IQueueProcessor {
  constructor(
    private config: EnvironmentConfig,
    private dynamoClient: IDynamoDBClient,
    private s3Client: IS3Client
  ) {}
  
  // Methods for queue operations
}
```

### 4. Service Factory (`src/config/service-factory.ts`)

Manages the creation and wiring of all services:

```typescript
export class ServiceFactory {
  static createServices(config?: EnvironmentConfig): ServiceContainer {
    const envConfig = config || createEnvironmentConfig();
    const { dynamoClient, s3Client } = createAWSClients(envConfig.awsRegion);
    
    const authService = new AuthService(envConfig);
    const queueProcessor = new QueueProcessor(envConfig, dynamoClient, s3Client);
    const photosService = new PhotosService(envConfig, dynamoClient, s3Client, queueProcessor);
    
    return { authService, photosService, queueProcessor };
  }
}
```

## Usage in Routes

Routes now use the service factory to get service instances:

```typescript
// In a route handler
const { photosService } = ServiceFactory.createServices();
const result = await photosService.uploadImage(userId, imageBuffer, filename, contentType);
```

## Testing

The new architecture makes unit testing much easier. Here's an example:

```typescript
// Create mock dependencies
const mockConfig: EnvironmentConfig = {
  awsRegion: "us-east-1",
  port: 8000,
  dynamodbTable: "test-table",
  s3Bucket: "test-bucket",
  openaiApiKey: "test-key",
  googleOauthClientId: "test-client-id",
};

class MockDynamoDBClient {
  public send = async <T>(command: any): Promise<T> => {
    return {} as T; // Return mock data
  };
}

class MockS3Client {
  public send = async <T>(command: any): Promise<T> => {
    return {} as T; // Return mock data
  };
}

class MockQueueProcessor implements IQueueProcessor {
  public initializeQueue = async (): Promise<void> => {};
  public setupQueueListener = async (): Promise<void> => {};
  public enqueuePhotoProcessing = async (): Promise<void> => {};
}

// Test the service
Deno.test("PhotosService test", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  const mockQueueProcessor = new MockQueueProcessor();
  
  const photosService = new PhotosService(
    mockConfig,
    mockDynamoClient,
    mockS3Client,
    mockQueueProcessor
  );
  
  // Test service methods
  assertEquals(photosService instanceof PhotosService, true);
});
```

## Benefits

1. **Testability**: All dependencies can be easily mocked
2. **Maintainability**: Clear separation of concerns
3. **Flexibility**: Easy to swap implementations
4. **Type Safety**: Strong typing throughout the application
5. **Dependency Injection**: Services receive their dependencies explicitly

## Running Tests

```bash
deno task test
```

## Migration Notes

- All environment variables are now centralized in `EnvironmentConfig`
- AWS clients are injected rather than imported directly
- Services are instantiated through the `ServiceFactory`
- Routes use the factory to get service instances
- All services implement interfaces for better testability 