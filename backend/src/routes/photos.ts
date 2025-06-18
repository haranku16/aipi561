import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { 
  PhotoUploadResponse, 
  PhotoListResponse, 
  ErrorResponse
} from "../types/index.ts";
import { generatePresignedUrl, listPhotos, uploadImage, getPhoto, getPhotoByLookupKey, deletePhoto } from "../services/photos.ts";
import { requireAuth } from "../middleware/auth-helpers.ts";
import { s3Client } from "../config/index.ts";
import { GetObjectCommand } from "@aws-sdk/client-s3";
import { getSignedUrl } from "@aws-sdk/s3-request-presigner";

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

// Get presigned URL for viewing a specific photo
router.get("/:lookupKey/url", async (ctx) => {
  try {
    const user = requireAuth(ctx);
    const lookupKey = ctx.params.lookupKey;
    
    if (!lookupKey) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Lookup key is required" } as ErrorResponse;
      return;
    }

    // Verify the photo belongs to the user by querying DynamoDB
    const photo = await getPhotoByLookupKey(user.email, lookupKey);
    
    if (!photo) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Photo not found" } as ErrorResponse;
      return;
    }
    
    const getObjectInput = {
      Bucket: Deno.env.get("S3_BUCKET")!,
      Key: photo.s3Key,
    };

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

// Get photo status by lookupKey
router.get("/:lookupKey/status", async (ctx) => {
  try {
    const user = requireAuth(ctx);
    const lookupKey = ctx.params.lookupKey;
    
    if (!lookupKey) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Lookup key is required" } as ErrorResponse;
      return;
    }

    // Get the photo metadata from DynamoDB using direct lookup
    const photo = await getPhotoByLookupKey(user.email, lookupKey);
    
    if (!photo) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Photo not found" } as ErrorResponse;
      return;
    }
    
    // Return the photo status and metadata
    ctx.response.body = {
      photoId: photo.photoId,
      status: photo.status,
      uploadTimestamp: photo.uploadTimestamp,
      title: photo.title,
      description: photo.description,
      processingError: photo.processingError
    };
  } catch (error) {
    console.error("Get status error:", error);
    if (error instanceof Error && error.message === "Authentication required") {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" } as ErrorResponse;
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to get photo status" } as ErrorResponse;
    }
  }
});

// Delete a photo by lookupKey
router.delete("/:lookupKey", async (ctx) => {
  try {
    const user = requireAuth(ctx);
    const lookupKey = ctx.params.lookupKey;
    
    if (!lookupKey) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Lookup key is required" } as ErrorResponse;
      return;
    }

    const success = await deletePhoto(user.email, lookupKey);
    
    if (!success) {
      ctx.response.status = 404;
      ctx.response.body = { error: "Photo not found or could not be deleted" } as ErrorResponse;
      return;
    }
    
    ctx.response.status = 204; // No content
  } catch (error) {
    console.error("Delete photo error:", error);
    if (error instanceof Error && error.message === "Authentication required") {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" } as ErrorResponse;
    } else {
      ctx.response.status = 500;
      ctx.response.body = { error: "Failed to delete photo" } as ErrorResponse;
    }
  }
});

export default router; 