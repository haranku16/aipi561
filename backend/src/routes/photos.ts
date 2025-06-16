import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { 
  PhotoUploadResponse, 
  PhotoListResponse, 
  PhotoSearchRequest, 
  PhotoSearchResponse,
  ErrorResponse 
} from "../types/index.ts";
import { generatePresignedUrl, listPhotos, searchPhotos } from "../services/photos.ts";
import { verifyGoogleToken } from "../services/auth.ts";

const router = new Router({ prefix: "/api/photos" });

// Middleware to verify auth token and extract user info
async function authMiddleware(ctx: any, next: any) {
  const authHeader = ctx.request.headers.get("Authorization");
  if (!authHeader?.startsWith("Bearer ")) {
    ctx.response.status = 401;
    ctx.response.body = { error: "Missing or invalid authorization token" } as ErrorResponse;
    return;
  }

  try {
    const token = authHeader.split(" ")[1];
    const userInfo = await verifyGoogleToken(token);
    ctx.state.user = userInfo;
    await next();
  } catch (error) {
    console.error("Auth error:", error);
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid or expired token" } as ErrorResponse;
  }
}

// Apply auth middleware to all routes
router.use(authMiddleware);

// Get pre-signed URL for photo upload
router.post("/upload", async (ctx) => {
  try {
    const { filename, contentType } = await ctx.request.body().value;
    
    if (!filename || !contentType) {
      ctx.response.status = 400;
      ctx.response.body = { error: "Filename and content type are required" } as ErrorResponse;
      return;
    }

    const { photoId, uploadUrl } = await generatePresignedUrl(
      ctx.state.user.email,
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
    console.error("Upload error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to generate upload URL" } as ErrorResponse;
  }
});

// List user's photos
router.get("/", async (ctx) => {
  try {
    const nextToken = ctx.request.url.searchParams.get("nextToken") || undefined;
    const pageSize = parseInt(ctx.request.url.searchParams.get("pageSize") || "20");

    const response: PhotoListResponse = await listPhotos(
      ctx.state.user.email,
      pageSize,
      nextToken
    );

    ctx.response.body = response;
  } catch (error) {
    console.error("List photos error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to list photos" } as ErrorResponse;
  }
});

// Search photos
router.get("/search", async (ctx) => {
  try {
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
      ctx.state.user.email,
      searchRequest
    );

    ctx.response.body = response;
  } catch (error) {
    console.error("Search error:", error);
    ctx.response.status = 500;
    ctx.response.body = { error: "Failed to search photos" } as ErrorResponse;
  }
});

export default router; 