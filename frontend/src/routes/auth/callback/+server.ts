import { redirect, error, type RequestHandler } from '@sveltejs/kit';
import { exchangeCodeForTokens, getUserInfo } from '../../../lib/server/auth.ts';

export const GET: RequestHandler = async ({ url, cookies }) => {
  // Get the authorization code and state from the URL
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const storedState = cookies.get('oauth_state');

  console.log('OAuth Callback Debug:', {
    receivedState: state,
    storedState,
    statesMatch: state === storedState,
    hasCode: !!code,
    redirectUri: import.meta.env.DEV 
      ? 'http://localhost:5173/auth/callback'
      : 'https://your-production-domain.com/auth/callback'
  });

  // Verify state parameter to prevent CSRF
  if (!state || !storedState || state !== storedState) {
    console.error('State parameter mismatch:', {
      receivedState: state,
      storedState,
      statesMatch: state === storedState
    });
    throw error(400, 'Invalid state parameter');
  }

  // Clear the state cookie
  cookies.delete('oauth_state', { path: '/' });

  if (!code) {
    console.error('No authorization code provided');
    throw error(400, 'No authorization code provided');
  }

  try {
    // Exchange the code for tokens
    const tokens = await exchangeCodeForTokens(code);

    // Get user info from Google
    const userInfo = await getUserInfo(tokens.access_token);

    // Store the tokens securely
    cookies.set('access_token', tokens.access_token, {
      path: '/',
      httpOnly: true,
      secure: !import.meta.env.DEV,
      sameSite: 'lax',
      maxAge: 60 * 60 // 1 hour
    });

    if (tokens.refresh_token) {
      cookies.set('refresh_token', tokens.refresh_token, {
        path: '/',
        httpOnly: true,
        secure: !import.meta.env.DEV,
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30 // 30 days
      });
    }

    // Store user info in a session cookie
    cookies.set('user', JSON.stringify({
      email: userInfo.email,
      name: userInfo.name,
      picture: userInfo.picture
    }), {
      path: '/',
      httpOnly: true,
      secure: !import.meta.env.DEV,
      sameSite: 'lax',
      maxAge: 60 * 60 // 1 hour
    });

    // Get the redirect URL from cookies or default to home
    const redirectUrl = cookies.get('redirect_after_login') || '/';
    cookies.delete('redirect_after_login', { path: '/' });

    throw redirect(302, redirectUrl);
  } catch (e) {
    // SvelteKit's redirect error has status and location properties
    if (e && typeof e === 'object' && 'status' in e && 'location' in e) {
      throw e;
    }
    if (e instanceof Error) {
      console.error('OAuth callback error:', e.message, e.stack);
    } else {
      console.error('OAuth callback error:', e);
    }
    throw error(500, 'Failed to complete authentication');
  }
}; 