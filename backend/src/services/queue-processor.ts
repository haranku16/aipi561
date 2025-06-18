/// <reference lib="deno.unstable" />

import {
  UpdateItemCommand,
  QueryCommand,
  type UpdateItemCommandInput,
  type QueryCommandInput
} from "@aws-sdk/client-dynamodb";
import { 
  GetObjectCommand
} from "@aws-sdk/client-s3";
import { EnvironmentConfig } from "../config/environment.ts";
import { IDynamoDBClient, IS3Client } from "../config/aws-clients.ts";

// Define the message structure for the queue
interface PhotoProcessingMessage {
  photoId: string;
  userId: string;
  s3Key: string;
  timestamp: string;
}

export interface IQueueProcessor {
  initializeQueue(): Promise<void>;
  setupQueueListener(): Promise<void>;
  enqueuePhotoProcessing(photoId: string, userId: string, s3Key: string): Promise<void>;
}

export class QueueProcessor implements IQueueProcessor {
  private kv: Deno.Kv | null = null;

  constructor(
    private config: EnvironmentConfig,
    private dynamoClient: IDynamoDBClient,
    private s3Client: IS3Client
  ) {}

  // Initialize the KV store
  async initializeQueue(): Promise<void> {
    if (!this.kv) {
      this.kv = await Deno.openKv();
      console.log("KV store initialized for queue processing");
    }
  }

  // Set up queue listener for photo processing
  async setupQueueListener(): Promise<void> {
    if (!this.kv) {
      await this.initializeQueue();
    }

    // Listen for photo processing messages
    this.kv!.listenQueue(async (msg: PhotoProcessingMessage) => {
      try {
        console.log(`Processing photo ${msg.photoId} from queue`);
        await this.processPhotoWithAI(msg.photoId, msg.userId, msg.s3Key);
      } catch (error) {
        console.error(`Queue processing failed for photo ${msg.photoId}:`, error);
        // The queue will automatically retry on failure
      }
    });

    console.log("Queue listener set up for photo processing");
  }

  // Enqueue a photo for AI processing
  async enqueuePhotoProcessing(
    photoId: string,
    userId: string,
    s3Key: string
  ): Promise<void> {
    if (!this.kv) {
      await this.initializeQueue();
    }

    const message: PhotoProcessingMessage = {
      photoId,
      userId,
      s3Key,
      timestamp: new Date().toISOString()
    };

    // Enqueue the message for immediate processing
    await this.kv!.enqueue(message);
    console.log(`Photo ${photoId} enqueued for AI processing`);
  }

  // Get image from S3 and convert to base64
  private async getImageAsBase64(s3Key: string): Promise<string> {
    const getObjectInput = {
      Bucket: this.config.s3Bucket,
      Key: s3Key,
    };

    const response = await this.s3Client.send(new GetObjectCommand(getObjectInput));
    
    if (!response.Body) {
      throw new Error("Failed to retrieve image from S3");
    }

    // Convert the readable stream to Uint8Array
    const chunks: Uint8Array[] = [];
    for await (const chunk of response.Body as any) {
      chunks.push(chunk);
    }
    
    const imageBuffer = new Uint8Array(chunks.reduce((acc, chunk) => acc + chunk.length, 0));
    let offset = 0;
    for (const chunk of chunks) {
      imageBuffer.set(chunk, offset);
      offset += chunk.length;
    }

    // Convert to base64
    let binary = '';
    const len = imageBuffer.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(imageBuffer[i]);
    }
    return btoa(binary);
  }

  // Generate AI title and description using OpenAI GPT-4o-mini
  private async generateAIContent(imageBase64: string, photoId: string): Promise<{ title: string; description: string }> {
    const prompt = `Please analyze this image and generate SEO-optimized metadata for a photo sharing platform.

REQUIREMENTS:
- Title: Maximum 60 characters, compelling and descriptive
- Description: Maximum 160 characters, engaging and informative

INSTRUCTIONS:
1. Analyze the image content thoroughly including:
   - Main subjects, objects, or scenes
   - Colors, lighting, and mood
   - Composition and style
   - Any text, logos, or distinctive features
   - Background elements and context

2. Generate content that is:
   - Specific and descriptive about what you see
   - Engaging and click-worthy
   - SEO-friendly with relevant keywords
   - Professional yet accessible

3. Respond with a JSON object in this exact format:
{
  "title": "Your title here",
  "description": "Your description here"
}

Please be detailed in your analysis and create content that would help users discover and understand this photo.`;

    const response = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${this.config.openaiApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: prompt
              },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/jpeg;base64,${imageBase64}`,
                  detail: "high"
                }
              }
            ]
          }
        ],
        max_tokens: 300,
        temperature: 0.7,
        response_format: { type: "json_object" }
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`OpenAI API error: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    const content = data.choices[0]?.message?.content;

    if (!content) {
      throw new Error("No content received from OpenAI API");
    }

    try {
      // Parse the JSON response
      const aiResponse = JSON.parse(content);
      
      if (!aiResponse.title || !aiResponse.description) {
        throw new Error("Invalid JSON response: missing title or description");
      }

      let title = aiResponse.title.toString().trim();
      let description = aiResponse.description.toString().trim();

      // Ensure character limits
      title = title.length > 60 ? title.substring(0, 57) + "..." : title;
      description = description.length > 160 ? description.substring(0, 157) + "..." : description;

      return { title, description };
    } catch (parseError) {
      console.error("Failed to parse AI response as JSON:", parseError);
      console.error("Raw response:", content);
      
      // Fallback to a default response
      return {
        title: `AI Generated Title for ${photoId}`,
        description: "AI-generated description for this photo"
      };
    }
  }

  // Background task to process photo with AI
  private async processPhotoWithAI(
    photoId: string,
    userId: string,
    s3Key: string
  ): Promise<void> {
    try {
      console.log(`Starting AI processing for photo ${photoId}`);
      
      // Step 1: Update status to "processing"
      await this.updatePhotoStatus(photoId, userId, "processing");
      
      // Step 2: Get image from S3 and convert to base64
      console.log(`Retrieving image ${s3Key} from S3`);
      const imageBase64 = await this.getImageAsBase64(s3Key);
      
      // Step 3: Generate AI content using OpenAI
      console.log(`Generating AI content for photo ${photoId}`);
      const { title, description } = await this.generateAIContent(imageBase64, photoId);
      
      console.log(`AI generated title: "${title}"`);
      console.log(`AI generated description: "${description}"`);
      
      // Step 4: Update DynamoDB with AI results and set status to "completed"
      await this.updatePhotoWithAIResults(photoId, userId, title, description, "completed");
      
      console.log(`AI processing completed for photo ${photoId}`);
      
    } catch (error) {
      console.error(`AI processing failed for photo ${photoId}:`, error);
      
      // Update status to "failed" with error message
      await this.updatePhotoStatus(photoId, userId, "failed", error instanceof Error ? error.message : "Unknown error");
      
      // Re-throw the error so the queue can retry
      throw error;
    }
  }

  // Get the sort key for a photo
  private async getPhotoSortKey(photoId: string, userId: string): Promise<string | null> {
    const queryInput: QueryCommandInput = {
      TableName: this.config.dynamodbTable,
      KeyConditionExpression: "PK = :pk",
      FilterExpression: "photoId = :photoId",
      ExpressionAttributeValues: {
        ":pk": { S: `USER#${userId}` },
        ":photoId": { S: photoId }
      }
    };

    const result = await this.dynamoClient.send(new QueryCommand(queryInput));
    
    if (!result.Items || result.Items.length === 0) {
      return null;
    }

    return result.Items[0].SK.S!;
  }

  // Update photo status in DynamoDB
  private async updatePhotoStatus(
    photoId: string,
    userId: string,
    status: 'processing' | 'completed' | 'failed',
    errorMessage?: string
  ): Promise<void> {
    const sortKey = await this.getPhotoSortKey(photoId, userId);
    
    if (!sortKey) {
      throw new Error(`Photo ${photoId} not found for user ${userId}`);
    }

    const updateInput: UpdateItemCommandInput = {
      TableName: this.config.dynamodbTable,
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

    await this.dynamoClient.send(new UpdateItemCommand(updateInput));
  }

  // Update photo with AI results
  private async updatePhotoWithAIResults(
    photoId: string,
    userId: string,
    title: string,
    description: string,
    status: 'completed'
  ): Promise<void> {
    const sortKey = await this.getPhotoSortKey(photoId, userId);
    
    if (!sortKey) {
      throw new Error(`Photo ${photoId} not found for user ${userId}`);
    }

    const updateInput: UpdateItemCommandInput = {
      TableName: this.config.dynamodbTable,
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

    await this.dynamoClient.send(new UpdateItemCommand(updateInput));
  }
}