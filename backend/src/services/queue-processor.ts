/// <reference lib="deno.unstable" />

import { dynamoClient } from "../config/index.ts";
import { 
  DynamoDBClient,
  UpdateItemCommand,
  QueryCommand,
  type UpdateItemCommandInput,
  type QueryCommandInput,
  type AttributeValue
} from "https://deno.land/x/aws_sdk@v3.32.0-1/client-dynamodb/mod.ts";

const DYNAMODB_TABLE = Deno.env.get("DYNAMODB_TABLE");

if (!DYNAMODB_TABLE) {
  throw new Error("DYNAMODB_TABLE environment variable is required");
}

// Define the message structure for the queue
interface PhotoProcessingMessage {
  photoId: string;
  userId: string;
  s3Key: string;
  timestamp: string;
}

// Initialize KV store for queues
let kv: Deno.Kv | null = null;

// Initialize the KV store
export async function initializeQueue(): Promise<void> {
  if (!kv) {
    kv = await Deno.openKv();
    console.log("KV store initialized for queue processing");
  }
}

// Set up queue listener for photo processing
export async function setupQueueListener(): Promise<void> {
  if (!kv) {
    await initializeQueue();
  }

  // Listen for photo processing messages
  kv!.listenQueue(async (msg: PhotoProcessingMessage) => {
    try {
      console.log(`Processing photo ${msg.photoId} from queue`);
      await processPhotoWithAI(msg.photoId, msg.userId, msg.s3Key);
    } catch (error) {
      console.error(`Queue processing failed for photo ${msg.photoId}:`, error);
      // The queue will automatically retry on failure
    }
  });

  console.log("Queue listener set up for photo processing");
}

// Enqueue a photo for AI processing
export async function enqueuePhotoProcessing(
  photoId: string,
  userId: string,
  s3Key: string
): Promise<void> {
  if (!kv) {
    await initializeQueue();
  }

  const message: PhotoProcessingMessage = {
    photoId,
    userId,
    s3Key,
    timestamp: new Date().toISOString()
  };

  // Enqueue the message for immediate processing
  await kv!.enqueue(message);
  console.log(`Photo ${photoId} enqueued for AI processing`);
}

// Background task to process photo with AI
async function processPhotoWithAI(
  photoId: string,
  userId: string,
  s3Key: string
): Promise<void> {
  try {
    console.log(`Starting AI processing for photo ${photoId}`);
    
    // Step 1: Update status to "processing"
    await updatePhotoStatus(photoId, userId, "processing");
    
    // Step 2: Simulate AI processing delay (replace with actual AI calls)
    await simulateAIProcessing();
    
    // Step 3: Generate placeholder AI content (replace with actual AI responses)
    const aiTitle = `AI Generated Title for ${photoId}`;
    const aiDescription = `This is an AI-generated description for the photo with ID ${photoId}. The AI would analyze the image content and provide meaningful insights about what it sees.`;
    
    // Step 4: Update DynamoDB with AI results and set status to "completed"
    await updatePhotoWithAIResults(photoId, userId, aiTitle, aiDescription, "completed");
    
    console.log(`AI processing completed for photo ${photoId}`);
    
  } catch (error) {
    console.error(`AI processing failed for photo ${photoId}:`, error);
    
    // Update status to "failed" with error message
    await updatePhotoStatus(photoId, userId, "failed", error instanceof Error ? error.message : "Unknown error");
    
    // Re-throw the error so the queue can retry
    throw error;
  }
}

// Get the sort key for a photo
async function getPhotoSortKey(photoId: string, userId: string): Promise<string | null> {
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

  return result.Items[0].SK.S!;
}

// Update photo status in DynamoDB
async function updatePhotoStatus(
  photoId: string,
  userId: string,
  status: 'processing' | 'completed' | 'failed',
  errorMessage?: string
): Promise<void> {
  const sortKey = await getPhotoSortKey(photoId, userId);
  
  if (!sortKey) {
    throw new Error(`Photo ${photoId} not found for user ${userId}`);
  }

  const updateInput: UpdateItemCommandInput = {
    TableName: DYNAMODB_TABLE,
    Key: {
      PK: { S: `USER#${userId}` },
      SK: { S: sortKey }
    },
    UpdateExpression: "SET #status = :status",
    ExpressionAttributeNames: {
      "#status": "status"
    },
    ExpressionAttributeValues: {
      ":status": { S: status }
    }
  };

  // Add error message if provided
  if (errorMessage) {
    updateInput.UpdateExpression += ", #error = :error";
    updateInput.ExpressionAttributeNames!["#error"] = "processingError";
    updateInput.ExpressionAttributeValues![":error"] = { S: errorMessage };
  }

  await dynamoClient.send(new UpdateItemCommand(updateInput));
}

// Update photo with AI results
async function updatePhotoWithAIResults(
  photoId: string,
  userId: string,
  title: string,
  description: string,
  status: 'completed'
): Promise<void> {
  const sortKey = await getPhotoSortKey(photoId, userId);
  
  if (!sortKey) {
    throw new Error(`Photo ${photoId} not found for user ${userId}`);
  }

  const updateInput: UpdateItemCommandInput = {
    TableName: DYNAMODB_TABLE,
    Key: {
      PK: { S: `USER#${userId}` },
      SK: { S: sortKey }
    },
    UpdateExpression: "SET #status = :status, #title = :title, #description = :description",
    ExpressionAttributeNames: {
      "#status": "status",
      "#title": "title",
      "#description": "description"
    },
    ExpressionAttributeValues: {
      ":status": { S: status },
      ":title": { S: title },
      ":description": { S: description }
    }
  };

  await dynamoClient.send(new UpdateItemCommand(updateInput));
}

// Simulate AI processing delay
async function simulateAIProcessing(): Promise<void> {
  // Simulate API calls to AI services
  console.log("Simulating AI processing...");
  
  // Simulate image analysis
  await new Promise(resolve => setTimeout(resolve, 1000));
  console.log("Image analysis completed");
  
  // Simulate title generation
  await new Promise(resolve => setTimeout(resolve, 500));
  console.log("Title generation completed");
  
  // Simulate description generation
  await new Promise(resolve => setTimeout(resolve, 800));
  console.log("Description generation completed");
} 