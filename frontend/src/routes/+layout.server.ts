import type { LayoutServerLoad } from './$types';
import type { RequestEvent } from '@sveltejs/kit';
import { redirect } from '@sveltejs/kit';

// List of paths that should not be stored as redirect URLs
const EXCLUDED_PATHS = [
  '/.well-known/',
  '/auth/',
  '/api/',
  '/_svelte/',
  '/favicon.ico'
];

export const load: LayoutServerLoad = async ({ cookies, url }: RequestEvent) => {
  // Get user info from the session cookie
  const userCookie = cookies.get('user');
  const user = userCookie ? JSON.parse(userCookie) : null;

  // Get the current path
  const path = url.pathname;

  // If user is not authenticated and trying to access a protected route
  if (!user && path !== '/') {
    // Check if the path should be stored as a redirect URL
    const shouldStoreRedirect = !EXCLUDED_PATHS.some(excludedPath => 
      path.startsWith(excludedPath)
    );

    if (shouldStoreRedirect) {
      // Store the attempted URL to redirect back after login
      cookies.set('redirect_after_login', path, {
        path: '/',
        httpOnly: true,
        secure: !import.meta.env.DEV,
        sameSite: 'lax',
        maxAge: 60 * 10 // 10 minutes
      });
    }
    throw redirect(302, '/');
  }

  return {
    user
  };
}; 