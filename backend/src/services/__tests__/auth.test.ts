import { assertEquals, assertRejects } from "https://deno.land/std@0.208.0/assert/mod.ts";
import { AuthService } from "../auth.ts";
import { EnvironmentConfig } from "../../config/environment.ts";

// Mock environment config
const mockEnv: EnvironmentConfig = {
  awsRegion: "us-east-1",
  port: 8000,
  dynamodbTable: "test-table",
  s3Bucket: "test-bucket",
  openaiApiKey: "test-openai-key",
  googleOauthClientId: "test-google-client-id"
};

const userInfoResponse = {
  email: "test@example.com",
  name: "Test User",
  given_name: "Test",
  family_name: "User",
  picture: "http://example.com/pic.jpg"
};

Deno.test("AuthService - constructor", () => {
  const authService = new AuthService(mockEnv);
  assertEquals(authService instanceof AuthService, true);
});

Deno.test("AuthService - verifyGoogleToken success", async () => {
  const authService = new AuthService(mockEnv);
  
  // Mock fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return {
      ok: true,
      json: async () => userInfoResponse
    } as Response;
  };

  const result = await authService.verifyGoogleToken("valid-token");
  assertEquals(result, userInfoResponse);

  globalThis.fetch = originalFetch;
});

Deno.test("AuthService - verifyGoogleToken invalid token", async () => {
  const authService = new AuthService(mockEnv);
  
  // Mock fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    return {
      ok: false,
      json: async () => ({ error: "invalid_token" })
    } as Response;
  };

  await assertRejects(
    async () => await authService.verifyGoogleToken("invalid-token"),
    Error,
    "Failed to verify token"
  );

  globalThis.fetch = originalFetch;
});

Deno.test("AuthService - verifyGoogleToken fetch throws error", async () => {
  const authService = new AuthService(mockEnv);
  
  // Mock fetch
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async (_input: RequestInfo | URL, _init?: RequestInit) => {
    throw new Error("Network error");
  };

  await assertRejects(
    async () => await authService.verifyGoogleToken("any-token"),
    Error,
    "Failed to verify token"
  );

  globalThis.fetch = originalFetch;
}); 