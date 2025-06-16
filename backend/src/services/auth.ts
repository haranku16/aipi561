import { UserInfo } from "../types/index.ts";

const GOOGLE_OAUTH_CLIENT_ID = Deno.env.get("GOOGLE_OAUTH_CLIENT_ID");
if (!GOOGLE_OAUTH_CLIENT_ID) {
  throw new Error("GOOGLE_OAUTH_CLIENT_ID environment variable is required");
}

export async function verifyGoogleToken(token: string): Promise<UserInfo> {
  try {
    // Call Google's tokeninfo endpoint to verify the token
    const response = await fetch(`https://www.googleapis.com/oauth2/v3/userinfo`, {
      headers: {
        Authorization: `Bearer ${token}`
      }
    });

    if (!response.ok) {
      throw new Error("Invalid token");
    }

    const data = await response.json();

    // Return the user info
    return {
      email: data.email,
      name: data.name,
      given_name: data.given_name,
      family_name: data.family_name,
      picture: data.picture,
    };
  } catch (error) {
    console.error("Token verification error:", error);
    throw new Error("Failed to verify token");
  }
} 