import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { 
  PhotoUploadResponse, 
  PhotoListResponse, 
  PhotoSearchRequest, 
  PhotoSearchResponse,
  ErrorResponse,
  PhotoMetadata 
} from "../types/index.ts";
import { generatePresignedUrl, listPhotos, searchPhotos, uploadImage, getPhoto } from "../services/photos.ts";
import { requireAuth } from "../middleware/auth-helpers.ts";

const router = new Router({ prefix: "/api/photos" });

// Upload image directly (JSON with base64 image data)
router.post("/upload", async (ctx) => {
  try {
    const user = requireAuth(ctx);
    
    // Parse JSON body with base64 image data
    const { imageData, filename, contentType } = await ctx.request.body().value;
    
    if (!imageData || !filename || !contentType) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Image data, filename, and content type are required" } as ErrorResponse;
      return;
    }

    // Validate content type
    if (!contentType.startsWith("image/")) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Content type must be an image" } as ErrorResponse;
      return;
    }

    // Decode base64 image data
    let imageBuffer: Uint8Array;
    try {
      // Remove data URL prefix if present
      const base64Data = imageData.replace(/^data:image\/[a-z]+;base64,/, '');
      imageBuffer = new Uint8Array(atob(base64Data).split('').map(char => char.charCodeAt(0)));
    } catch (decodeError) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Invalid base64 image data" } as ErrorResponse;
      return;
    }

    // Upload image and get metadata
    const { photoMetadata, presignedUrl } = await uploadImage(
      user.email,
      imageBuffer,
      filename,
      contentType
    );

    // Return the photo metadata with presigned URL
    const response = {
      ...photoMetadata,
      presignedUrl
    };

    ctx.response.body = response;
  } catch (error) {
    console.error("Upload error:", error);
    if (error instanceof Error && error.message === "Authentication required") {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" } as ErrorResponse;
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to upload image" } as ErrorResponse;
    }
  }
});

// Legacy endpoint for generating presigned URLs (for client-side uploads)
router.post("/upload-url", async (ctx) => {
  try {
    const user = requireAuth(ctx);
    const { filename, contentType } = await ctx.request.body().value;
    
    if (!filename || !contentType) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Filename and content type are required" } as ErrorResponse;
      return;
    }

    const { photoId, uploadUrl } = await generatePresignedUrl(
      user.email,
      filename,
      contentType
    );

    const response: PhotoUploadResponse = {
      photoId,
      uploadUrl,
      status: "pending"
    };

    ctx.response.body = response;
  } catch (error) {
    console.error("Upload URL error:", error);
    if (error instanceof Error && error.message === "Authentication required") {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" } as ErrorResponse;
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to generate upload URL" } as ErrorResponse;
    }
  }
});

// List user's photos
router.get("/", async (ctx) => {
  try {
    const user = requireAuth(ctx);
    const nextToken = ctx.request.url.searchParams.get("nextToken") || undefined;
    const pageSize = parseInt(ctx.request.url.searchParams.get("pageSize") || "20");

    const response: PhotoListResponse = await listPhotos(
      user.email,
      pageSize,
      nextToken
    );

    ctx.response.body = response;
  } catch (error) {
    console.error("List photos error:", error);
    if (error instanceof Error && error.message === "Authentication required") {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" } as ErrorResponse;
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to list photos" } as ErrorResponse;
    }
  }
});

// Search photos
router.get("/search", async (ctx) => {
  try {
    const user = requireAuth(ctx);
    const query = ctx.request.url.searchParams.get("query");
    if (!query) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Search query is required" } as ErrorResponse;
      return;
    }

    const nextToken = ctx.request.url.searchParams.get("nextToken") || undefined;
    const pageSize = parseInt(ctx.request.url.searchParams.get("pageSize") || "20");

    const searchRequest: PhotoSearchRequest = {
      query,
      pageSize,
      nextToken
    };

    const response: PhotoSearchResponse = await searchPhotos(
      user.email,
      searchRequest
    );

    ctx.response.body = response;
  } catch (error) {
    console.error("Search error:", error);
    if (error instanceof Error && error.message === "Authentication required") {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" } as ErrorResponse;
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to search photos" } as ErrorResponse;
    }
  }
});

// Get presigned URL for viewing a specific photo
router.get("/:photoId/url", async (ctx) => {
  try {
    const user = requireAuth(ctx);
    const photoId = ctx.params.photoId;
    
    if (!photoId) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Photo ID is required" } as ErrorResponse;
      return;
    }

    // Verify the photo belongs to the user by querying DynamoDB
    const photo = await getPhoto(photoId, user.email);
    
    if (!photo) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Photo not found" } as ErrorResponse;
      return;
    }
    
    const getObjectInput = {
      Bucket: Deno.env.get("S3_BUCKET")!,
      Key: photo.s3Key,
    };

    const { getSignedUrl } = await import("https://deno.land/x/aws_sdk@v3.32.0-1/s3-request-presigner/mod.ts");
    const { GetObjectCommand } = await import("https://deno.land/x/aws_sdk@v3.32.0-1/client-s3/mod.ts");
    const { S3Client } = await import("https://deno.land/x/aws_sdk@v3.32.0-1/client-s3/mod.ts");
    
    const s3Client = new S3Client({
      region: Deno.env.get("AWS_REGION") || "us-east-1",
    });

    const getCommand = new GetObjectCommand(getObjectInput);
    const presignedUrl = await getSignedUrl(s3Client, getCommand, { expiresIn: 3600 });

    ctx.response.body = { presignedUrl };
  } catch (error) {
    console.error("Get URL error:", error);
    if (error instanceof Error && error.message === "Authentication required") {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" } as ErrorResponse;
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to generate presigned URL" } as ErrorResponse;
    }
  }
});

export default router; 