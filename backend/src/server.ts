import { Application, Router } from "oak";
import { DynamoDBClient } from "dynamodb";

// Initialize DynamoDB client
const dynamoClient = new DynamoDBClient({
  region: Deno.env.get("AWS_REGION") || "us-east-1",
  endpoint: Deno.env.get("DYNAMODB_ENDPOINT"), // For local development
});

// Create router
const router = new Router();

// Health check endpoint
router.get("/health", (ctx) => {
  ctx.response.body = { status: "healthy" };
});

// Map upload endpoint
router.post("/api/map/upload", async (ctx) => {
  try {
    const formData = await ctx.request.body({ type: "form-data" }).value;
    const file = formData.get("file");
    
    if (!file || !(file instanceof File)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "No file provided" };
      return;
    }

    // TODO: Implement file upload to S3 and DynamoDB
    ctx.response.body = { 
      message: "File upload endpoint (not implemented)",
      filename: file.name,
      size: file.size,
    };
  } catch (error) {
    console.error("Upload error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// Map analysis endpoint
router.post("/api/map/analyze", async (ctx) => {
  try {
    const body = await ctx.request.body().value;
    const { mapId, coordinates } = body;

    if (!mapId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Map ID is required" };
      return;
    }

    // TODO: Implement map analysis using Llama model
    ctx.response.body = {
      message: "Map analysis endpoint (not implemented)",
      mapId,
      coordinates,
    };
  } catch (error) {
    console.error("Analysis error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// Create and configure application
const app = new Application();

// Error handling middleware
app.use(async (ctx, next) => {
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
});

// Logger middleware
app.use(async (ctx, next) => {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} - ${ms}ms`);
});

// Use router
app.use(router.routes());
app.use(router.allowedMethods());

// Start server
const port = parseInt(Deno.env.get("PORT") || "8000");
console.log(`Server running on port ${port}`);

await app.listen({ port }); 