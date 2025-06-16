import { redirect, type RequestHandler } from '@sveltejs/kit';
import { generateOAuthState, generateOAuthUrl } from '../../../lib/server/auth.ts';

export const GET: RequestHandler = async ({ cookies }) => {
  // Generate and store state parameter for CSRF protection
  const state = generateOAuthState();
  cookies.set('oauth_state', state, {
    path: '/',
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: 'lax',
    maxAge: 60 * 10 // 10 minutes
  });

  // Generate OAuth URL and redirect
  const authUrl = generateOAuthUrl(state);
  throw redirect(302, authUrl);
}; 