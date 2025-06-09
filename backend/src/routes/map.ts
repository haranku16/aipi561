import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { MapUploadResponse, MapAnalysisRequest, MapAnalysisResponse, ErrorResponse } from "../types/index.ts";
import { crypto } from "https://deno.land/std@0.208.0/crypto/mod.ts";

const router = new Router({ prefix: "/api/map" });

// Helper function to generate a unique map ID
function generateMapId(): string {
  const randomBytes = new Uint8Array(8);
  crypto.getRandomValues(randomBytes);
  return Array.from(randomBytes)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

router.post("/upload", async (ctx) => {
  try {
    const formData = await ctx.request.body({ type: "form-data" }).value;
    const file = formData.get("file");
    
    if (!file || !(file instanceof File)) {
      ctx.response.status = 400;
      ctx.response.body = { error: "No file provided" } as ErrorResponse;
      return;
    }

    // Generate a unique map ID for this upload
    const mapId = generateMapId();

    // TODO: Implement file upload to S3 and DynamoDB
    // For now, we'll just return a mock response
    const response: MapUploadResponse = {
      message: "File upload endpoint (not implemented)",
      filename: file.name,
      size: file.size,
      mapId,
    };
    ctx.response.body = response;
  } catch (error) {
    console.error("Upload error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" } as ErrorResponse;
  }
});

router.post("/analyze", async (ctx) => {
  try {
    const body = await ctx.request.body().value as MapAnalysisRequest;
    const { mapId } = body;

    if (!mapId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Map ID is required" } as ErrorResponse;
      return;
    }

    // TODO: Implement map analysis using Llama model
    // For now, return mock data that matches the new type
    const response: MapAnalysisResponse = {
      message: "Map analysis endpoint (not implemented)",
      mapId,
      currentLocation: {
        x: 100, // Example pixel coordinates for "you are here" marker
        y: 150,
      },
      mapImage: "base64_encoded_image_placeholder", // TODO: Return actual base64 encoded map image
      mapScale: {
        pixelsPerMeter: 10, // Example: 10 pixels = 1 meter
        referenceDistance: 5, // Example: scale is based on a 5-meter reference distance
      },
    };
    ctx.response.body = response;
  } catch (error) {
    console.error("Analysis error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" } as ErrorResponse;
  }
});

export default router; 