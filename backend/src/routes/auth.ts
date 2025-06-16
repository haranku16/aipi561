import { Router } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { UserInfo, ErrorResponse } from "../types/index.ts";
import { verifyGoogleToken } from "../services/auth.ts";

const router = new Router({ prefix: "/api/auth" });

router.get("/user", async (ctx) => {
  try {
    // Get the Authorization header
    const authHeader = ctx.request.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      ctx.response.status = 401;
      ctx.response.body = { error: "Missing or invalid authorization token" } as ErrorResponse;
      return;
    }

    // Extract the token
    const token = authHeader.split(" ")[1];
    
    // Verify the token and get user info
    const userInfo = await verifyGoogleToken(token);
    
    ctx.response.body = userInfo as UserInfo;
  } catch (error) {
    console.error("Auth error:", error);
    ctx.response.status = 401;
    ctx.response.body = { error: "Invalid or expired token" } as ErrorResponse;
  }
});

export default router; 