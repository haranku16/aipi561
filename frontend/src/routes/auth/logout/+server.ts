import { redirect, type RequestHandler } from '@sveltejs/kit';

export const POST: RequestHandler = async ({ cookies }) => {
  // Clear all auth-related cookies
  const cookieOptions = {
    path: '/',
    httpOnly: true,
    secure: !import.meta.env.DEV,
    sameSite: 'lax' as const
  };

  cookies.delete('access_token', cookieOptions);
  cookies.delete('refresh_token', cookieOptions);
  cookies.delete('user', cookieOptions);
  cookies.delete('redirect_after_login', cookieOptions);

  // Redirect to the splash page
  throw redirect(302, '/');
}; 