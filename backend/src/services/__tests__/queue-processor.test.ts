import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { QueueProcessor } from "../queue-processor.ts";
import { EnvironmentConfig } from "../../config/environment.ts";
import { IDynamoDBClient, IS3Client } from "../../config/aws-clients.ts";

// Mock implementations for testing
class MockDynamoDBClient {
  public send = async <T>(command: any): Promise<T> => {
    if (command.constructor.name === "QueryCommand") {
      // getPhotoSortKey query
      return {
        Items: [{
          SK: { S: "1704067200000#test-photo-id" }
        }]
      } as T;
    } else if (command.constructor.name === "UpdateItemCommand") {
      return {} as T;
    }
    return {} as T;
  };
}

class MockS3Client {
  public send = async <T>(command: any): Promise<T> => {
    if (command.constructor.name === "GetObjectCommand") {
      // Mock S3 response with image data
      return {
        Body: {
          [Symbol.asyncIterator]: async function* () {
            // Mock image data as chunks
            yield new Uint8Array([255, 216, 255, 224, 0, 16, 74, 70, 73, 70, 0, 1, 1, 1, 0, 72, 0, 72, 0, 0]);
          }
        }
      } as T;
    }
    return {} as T;
  };
}

// Mock fetch for OpenAI API
const originalFetch = globalThis.fetch;
let mockFetch: (input: string | URL | Request, init?: RequestInit) => Promise<Response>;

// Test configuration
const mockConfig: EnvironmentConfig = {
  awsRegion: "us-east-1",
  port: 8000,
  dynamodbTable: "test-table",
  s3Bucket: "test-bucket",
  openaiApiKey: "test-key",
  googleOauthClientId: "test-client-id",
};

// Mock KV store
const originalOpenKv = Deno.openKv;

Deno.test("QueueProcessor - constructor with dependencies", () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  assertEquals(queueProcessor instanceof QueueProcessor, true);
});

Deno.test("QueueProcessor - initializeQueue", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Mock Deno.openKv
  Deno.openKv = async () => {
    return {
      enqueue: async (message: any) => {},
      listenQueue: (handler: (message: any) => void) => {}
    } as any;
  };
  
  try {
    await queueProcessor.initializeQueue();
    // Should not throw
    assertEquals(true, true);
  } finally {
    Deno.openKv = originalOpenKv;
  }
});

Deno.test("QueueProcessor - setupQueueListener", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  let listenQueueCalled = false;
  
  // Mock Deno.openKv
  Deno.openKv = async () => {
    return {
      enqueue: async (message: any) => {},
      listenQueue: (handler: (message: any) => void) => {
        listenQueueCalled = true;
      }
    } as any;
  };
  
  try {
    await queueProcessor.setupQueueListener();
    assertEquals(listenQueueCalled, true);
  } finally {
    Deno.openKv = originalOpenKv;
  }
});

Deno.test("QueueProcessor - setupQueueListener with existing KV", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  let listenQueueCalled = false;
  
  // Mock Deno.openKv
  Deno.openKv = async () => {
    return {
      enqueue: async (message: any) => {},
      listenQueue: (handler: (message: any) => void) => {
        listenQueueCalled = true;
      }
    } as any;
  };
  
  try {
    // Initialize first
    await queueProcessor.initializeQueue();
    // Then setup listener
    await queueProcessor.setupQueueListener();
    assertEquals(listenQueueCalled, true);
  } finally {
    Deno.openKv = originalOpenKv;
  }
});

Deno.test("QueueProcessor - enqueuePhotoProcessing", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  let enqueuedMessage: any = null;
  
  // Mock Deno.openKv
  Deno.openKv = async () => {
    return {
      enqueue: async (message: any) => {
        enqueuedMessage = message;
      },
      listenQueue: (handler: (message: any) => void) => {}
    } as any;
  };
  
  try {
    await queueProcessor.enqueuePhotoProcessing("test-photo-id", "test@example.com", "test-key");
    
    assertEquals(enqueuedMessage.photoId, "test-photo-id");
    assertEquals(enqueuedMessage.userId, "test@example.com");
    assertEquals(enqueuedMessage.s3Key, "test-key");
    assertEquals(typeof enqueuedMessage.timestamp, "string");
  } finally {
    Deno.openKv = originalOpenKv;
  }
});

Deno.test("QueueProcessor - enqueuePhotoProcessing with existing KV", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  let enqueuedMessage: any = null;
  
  // Mock Deno.openKv
  Deno.openKv = async () => {
    return {
      enqueue: async (message: any) => {
        enqueuedMessage = message;
      },
      listenQueue: (handler: (message: any) => void) => {}
    } as any;
  };
  
  try {
    // Initialize first
    await queueProcessor.initializeQueue();
    // Then enqueue
    await queueProcessor.enqueuePhotoProcessing("test-photo-id", "test@example.com", "test-key");
    
    assertEquals(enqueuedMessage.photoId, "test-photo-id");
    assertEquals(enqueuedMessage.userId, "test@example.com");
    assertEquals(enqueuedMessage.s3Key, "test-key");
  } finally {
    Deno.openKv = originalOpenKv;
  }
});

Deno.test("QueueProcessor - getImageAsBase64", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Access private method for testing
  const result = await (queueProcessor as any).getImageAsBase64("test-key");
  
  assertEquals(typeof result, "string");
  assertEquals(result.length > 0, true);
  // Should be base64 encoded
  assertEquals(/^[A-Za-z0-9+/]*={0,2}$/.test(result), true);
});

Deno.test("QueueProcessor - getImageAsBase64 with null Body", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = {
    send: async <T>(command: any): Promise<T> => {
      if (command.constructor.name === "GetObjectCommand") {
        return { Body: null } as T;
      }
      return {} as T;
    }
  } as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  await assertRejects(
    async () => {
      await (queueProcessor as any).getImageAsBase64("test-key");
    },
    Error,
    "Failed to retrieve image from S3"
  );
});

Deno.test("QueueProcessor - generateAIContent success", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Mock successful OpenAI response
  mockFetch = async (input: string | URL | Request, init?: RequestInit) => {
    assertEquals(input, "https://api.openai.com/v1/chat/completions");
    
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            title: "Beautiful Sunset",
            description: "A stunning sunset over the mountains"
          })
        }
      }]
    };
    
    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  
  globalThis.fetch = mockFetch;
  
  try {
    const result = await (queueProcessor as any).generateAIContent("test-base64", "test-photo-id");
    
    assertEquals(result.title, "Beautiful Sunset");
    assertEquals(result.description, "A stunning sunset over the mountains");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("QueueProcessor - generateAIContent with OpenAI error", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Mock OpenAI error response
  mockFetch = async () => {
    return new Response(JSON.stringify({ error: "API key invalid" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };
  
  globalThis.fetch = mockFetch;
  
  try {
    await assertRejects(
      async () => {
        await (queueProcessor as any).generateAIContent("test-base64", "test-photo-id");
      },
      Error,
      "OpenAI API error: 401"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("QueueProcessor - generateAIContent with no content", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Mock OpenAI response with no content
  mockFetch = async () => {
    const mockResponse = {
      choices: [{
        message: {}
      }]
    };
    
    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  
  globalThis.fetch = mockFetch;
  
  try {
    await assertRejects(
      async () => {
        await (queueProcessor as any).generateAIContent("test-base64", "test-photo-id");
      },
      Error,
      "No content received from OpenAI API"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("QueueProcessor - generateAIContent with missing title or description", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Mock OpenAI response with missing title
  mockFetch = async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            description: "A stunning sunset over the mountains"
            // Missing title
          })
        }
      }]
    };
    
    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  
  globalThis.fetch = mockFetch;
  
  try {
    const result = await (queueProcessor as any).generateAIContent("test-base64", "test-photo-id");
    
    // Should return fallback values
    assertEquals(result.title, "AI Generated Title for test-photo-id");
    assertEquals(result.description, "AI-generated description for this photo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("QueueProcessor - generateAIContent with malformed JSON", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Mock OpenAI response with malformed JSON
  mockFetch = async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: "invalid json response"
        }
      }]
    };
    
    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  
  globalThis.fetch = mockFetch;
  
  try {
    const result = await (queueProcessor as any).generateAIContent("test-base64", "test-photo-id");
    
    // Should return fallback values
    assertEquals(result.title, "AI Generated Title for test-photo-id");
    assertEquals(result.description, "AI-generated description for this photo");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("QueueProcessor - generateAIContent with long content", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Mock OpenAI response with very long content
  const longTitle = "A".repeat(100);
  const longDescription = "B".repeat(200);
  
  mockFetch = async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            title: longTitle,
            description: longDescription
          })
        }
      }]
    };
    
    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  
  globalThis.fetch = mockFetch;
  
  try {
    const result = await (queueProcessor as any).generateAIContent("test-base64", "test-photo-id");
    
    // Should be truncated
    assertEquals(result.title.length <= 60, true);
    assertEquals(result.description.length <= 160, true);
    assertEquals(result.title.endsWith("..."), true);
    assertEquals(result.description.endsWith("..."), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("QueueProcessor - processPhotoWithAI success", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Mock successful OpenAI response
  mockFetch = async () => {
    const mockResponse = {
      choices: [{
        message: {
          content: JSON.stringify({
            title: "Beautiful Sunset",
            description: "A stunning sunset over the mountains"
          })
        }
      }]
    };
    
    return new Response(JSON.stringify(mockResponse), {
      status: 200,
      headers: { "Content-Type": "application/json" },
    });
  };
  
  globalThis.fetch = mockFetch;
  
  try {
    // Access private method for testing
    await (queueProcessor as any).processPhotoWithAI("test-photo-id", "test@example.com", "test-key");
    // Should not throw
    assertEquals(true, true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("QueueProcessor - processPhotoWithAI failure", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Mock OpenAI error response
  mockFetch = async () => {
    return new Response(JSON.stringify({ error: "API key invalid" }), {
      status: 401,
      headers: { "Content-Type": "application/json" },
    });
  };
  
  globalThis.fetch = mockFetch;
  
  try {
    await assertRejects(
      async () => {
        await (queueProcessor as any).processPhotoWithAI("test-photo-id", "test@example.com", "test-key");
      },
      Error,
      "OpenAI API error: 401"
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("QueueProcessor - getPhotoSortKey", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  const result = await (queueProcessor as any).getPhotoSortKey("test-photo-id", "test@example.com");
  
  assertEquals(result, "1704067200000#test-photo-id");
});

Deno.test("QueueProcessor - getPhotoSortKey not found", async () => {
  const mockDynamoClient = {
    send: async <T>(command: any): Promise<T> => {
      return { Items: [] } as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  const result = await (queueProcessor as any).getPhotoSortKey("non-existent", "test@example.com");
  
  assertEquals(result, null);
});

Deno.test("QueueProcessor - getPhotoSortKey with null Items", async () => {
  const mockDynamoClient = {
    send: async <T>(command: any): Promise<T> => {
      return { Items: null } as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  const result = await (queueProcessor as any).getPhotoSortKey("non-existent", "test@example.com");
  
  assertEquals(result, null);
});

Deno.test("QueueProcessor - updatePhotoStatus", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Should not throw
  await (queueProcessor as any).updatePhotoStatus("test-photo-id", "test@example.com", "processing");
  assertEquals(true, true);
});

Deno.test("QueueProcessor - updatePhotoStatus with error", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Should not throw
  await (queueProcessor as any).updatePhotoStatus("test-photo-id", "test@example.com", "failed", "Test error");
  assertEquals(true, true);
});

Deno.test("QueueProcessor - updatePhotoStatus with photo not found", async () => {
  const mockDynamoClient = {
    send: async <T>(command: any): Promise<T> => {
      if (command.constructor.name === "QueryCommand") {
        return { Items: [] } as T;
      }
      return {} as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  await assertRejects(
    async () => {
      await (queueProcessor as any).updatePhotoStatus("non-existent", "test@example.com", "processing");
    },
    Error,
    "Photo non-existent not found for user test@example.com"
  );
});

Deno.test("QueueProcessor - updatePhotoWithAIResults", async () => {
  const mockDynamoClient = new MockDynamoDBClient() as IDynamoDBClient;
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  // Should not throw
  await (queueProcessor as any).updatePhotoWithAIResults(
    "test-photo-id",
    "test@example.com",
    "Test Title",
    "Test Description",
    "completed"
  );
  assertEquals(true, true);
});

Deno.test("QueueProcessor - updatePhotoWithAIResults with photo not found", async () => {
  const mockDynamoClient = {
    send: async <T>(command: any): Promise<T> => {
      if (command.constructor.name === "QueryCommand") {
        return { Items: [] } as T;
      }
      return {} as T;
    }
  } as IDynamoDBClient;
  
  const mockS3Client = new MockS3Client() as IS3Client;
  
  const queueProcessor = new QueueProcessor(
    mockConfig,
    mockDynamoClient,
    mockS3Client
  );
  
  await assertRejects(
    async () => {
      await (queueProcessor as any).updatePhotoWithAIResults(
        "non-existent",
        "test@example.com",
        "Test Title",
        "Test Description",
        "completed"
      );
    },
    Error,
    "Photo non-existent not found for user test@example.com"
  );
}); 