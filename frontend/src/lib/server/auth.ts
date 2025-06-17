import { env } from '$env/dynamic/private';

// OAuth configuration
export const oauthConfig = {
  clientId: env.GOOGLE_OAUTH_CLIENT_ID,
  clientSecret: env.GOOGLE_OAUTH_CLIENT_SECRET,
  redirectUri: env.APP_URL + '/auth/callback',
  scopes: ['openid', 'profile', 'email'],
  authUrl: 'https://accounts.google.com/o/oauth2/v2/auth',
  tokenUrl: 'https://oauth2.googleapis.com/token',
  userInfoUrl: 'https://www.googleapis.com/oauth2/v3/userinfo'
};

// Generate OAuth state parameter for CSRF protection
export function generateOAuthState(): string {
  const state = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(state)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Generate OAuth URL
export function generateOAuthUrl(state: string): string {
  const params = new URLSearchParams({
    client_id: oauthConfig.clientId,
    redirect_uri: oauthConfig.redirectUri,
    response_type: 'code',
    scope: oauthConfig.scopes.join(' '),
    state,
    access_type: 'offline',
    prompt: 'consent'
  });

  return `${oauthConfig.authUrl}?${params.toString()}`;
}

// Exchange authorization code for tokens
export async function exchangeCodeForTokens(code: string): Promise<{
  access_token: string;
  id_token: string;
  refresh_token?: string;
}> {
  const params = new URLSearchParams({
    client_id: oauthConfig.clientId,
    client_secret: oauthConfig.clientSecret,
    code,
    grant_type: 'authorization_code',
    redirect_uri: oauthConfig.redirectUri
  });

  const response = await fetch(oauthConfig.tokenUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/x-www-form-urlencoded'
    },
    body: params.toString()
  });

  if (!response.ok) {
    throw new Error('Failed to exchange code for tokens');
  }

  return response.json();
}

// Get user info from Google
export async function getUserInfo(accessToken: string) {
  const response = await fetch(oauthConfig.userInfoUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`
    }
  });

  if (!response.ok) {
    throw new Error('Failed to get user info');
  }

  return response.json();
} 