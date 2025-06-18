# Authentication Middleware

This document explains how to use the authentication middleware that automatically fetches user data from Google tokens and makes it available to all route handlers.

## Overview

The authentication middleware (`authMiddleware`) automatically:
1. Extracts the Google OAuth token from the `Authorization: Bearer <token>` header
2. Verifies the token using Google's OAuth API
3. Fetches user information (email, name, picture, etc.)
4. Makes the user data available in `ctx.state.user` for all route handlers

## Setup

The middleware is already configured in `server.ts` and runs for all routes:

```typescript
app.use(authMiddleware);
```

## Usage in Route Handlers

### Helper Functions

Import the helper functions from `middleware/auth-helpers.ts`:

```typescript
import { requireAuth, getAuthenticatedUser, isAuthenticated } from "../middleware/auth-helpers.ts";
```

### Requiring Authentication

Use `requireAuth()` for routes that require a valid Google token:

```typescript
router.post("/protected-route", async (ctx) => {
  try {
    const user = requireAuth(ctx);
    // user.email, user.name, user.picture, etc. are now available
    ctx.response.body = { message: `Hello ${user.name}!` };
  } catch (error) {
    if (error instanceof Error && error.message === "Authentication required") {
      ctx.response.status = 401;
      ctx.response.body = { error: "Authentication required" };
    }
  }
});
```

### Optional Authentication

Use `getAuthenticatedUser()` for routes that work with or without authentication:

```typescript
router.get("/optional-auth", async (ctx) => {
  const user = getAuthenticatedUser(ctx);
  
  if (user) {
    ctx.response.body = { message: `Hello ${user.name}!` };
  } else {
    ctx.response.body = { message: "Hello anonymous user!" };
  }
});
```

### Checking Authentication Status

Use `isAuthenticated()` to check if a user is authenticated:

```typescript
router.get("/check-auth", async (ctx) => {
  if (isAuthenticated(ctx)) {
    const user = getAuthenticatedUser(ctx)!;
    ctx.response.body = { authenticated: true, user };
  } else {
    ctx.response.body = { authenticated: false };
  }
});
```

## User Information Structure

The user object contains the following fields from Google's OAuth API:

```typescript
interface UserInfo {
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}
```

## Error Handling

The middleware handles authentication errors gracefully:
- If no `Authorization` header is present, `ctx.state.user` will be `undefined`
- If the token is invalid or expired, `ctx.state.user` will be `undefined`
- No errors are thrown for authentication failures - routes can handle this as needed

## Examples

### Protected Route (requires authentication)
```typescript
router.post("/upload", async (ctx) => {
  const user = requireAuth(ctx);
  // Use user.email, user.name, etc.
});
```

### Public Route with Optional User Info
```typescript
router.get("/public", async (ctx) => {
  const user = getAuthenticatedUser(ctx);
  // Handle both authenticated and anonymous users
});
```

### Route with Custom Authentication Logic
```typescript
router.get("/custom", async (ctx) => {
  if (isAuthenticated(ctx)) {
    const user = getAuthenticatedUser(ctx)!;
    // Handle authenticated user
  } else {
    // Handle anonymous user
  }
});
```

## Security Notes

- The middleware only verifies tokens with Google's OAuth API
- Invalid or expired tokens are silently ignored (user becomes undefined)
- Always use `requireAuth()` for sensitive operations
- The middleware runs for all routes, so authentication is always attempted 