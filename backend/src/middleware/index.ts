import { Context, Next } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { ServiceFactory } from "../config/service-factory.ts";
import { UserInfo } from "../types/index.ts";

// Create a custom context type that includes user data
export interface AuthenticatedContext extends Context {
  state: {
    user?: UserInfo;
  } & Record<string, unknown>;
}

export async function errorHandler(ctx: Context, next: Next) {
  try {
    await next();
  } catch (err) {
    console.error(err);
    ctx.response.status = 500;
    ctx.response.body = { error: "Internal server error" };
  }
}

export async function logger(ctx: Context, next: Next) {
  const start = Date.now();
  await next();
  const ms = Date.now() - start;
  console.log(`${ctx.request.method} ${ctx.request.url.pathname} - ${ms}ms`);
}

export async function authMiddleware(ctx: AuthenticatedContext, next: Next) {
  // Initialize user state
  ctx.state.user = undefined;
  
  // Get the Authorization header
  const authHeader = ctx.request.headers.get("Authorization");
  
  if (authHeader && authHeader.startsWith("Bearer ")) {
    const token = authHeader.substring(7); // Remove "Bearer " prefix
    
    try {
      // Get services from factory
      const { authService } = ServiceFactory.createServices();
      
      // Verify the token and get user info
      const userInfo = await authService.verifyGoogleToken(token);
      ctx.state.user = userInfo;
    } catch (error) {
      console.error("Authentication error:", error);
      // Don't throw error here - just leave user as undefined
      // This allows routes to handle authentication as needed
    }
  }
  
  await next();
} 