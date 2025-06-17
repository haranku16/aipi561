import { Context } from "https://deno.land/x/oak@v12.6.1/mod.ts";
import { UserInfo } from "../types/index.ts";
import { AuthenticatedContext } from "./index.ts";

/**
 * Get the authenticated user from the context state
 * @param ctx The Oak context
 * @returns The user info if authenticated, undefined otherwise
 */
export function getAuthenticatedUser(ctx: Context): UserInfo | undefined {
  return (ctx as AuthenticatedContext).state.user;
}

/**
 * Require authentication - throws an error if user is not authenticated
 * @param ctx The Oak context
 * @returns The user info
 * @throws Error if user is not authenticated
 */
export function requireAuth(ctx: Context): UserInfo {
  const user = getAuthenticatedUser(ctx);
  if (!user) {
    throw new Error("Authentication required");
  }
  return user;
}

/**
 * Check if the context has an authenticated user
 * @param ctx The Oak context
 * @returns True if user is authenticated, false otherwise
 */
export function isAuthenticated(ctx: Context): boolean {
  return getAuthenticatedUser(ctx) !== undefined;
} 