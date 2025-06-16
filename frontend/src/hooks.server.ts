import { BACKEND_URL } from '$env/static/private';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Get the access token from cookies
  const accessToken = event.cookies.get('access_token');

  // If we have a token and this is an API request to our backend
  if (accessToken && event.url.pathname.startsWith('/api/')) {
    // Clone the request
    const request = event.request.clone();
    
    // Get the request body if it exists
    const body = request.body ? await request.text() : undefined;

    // Forward the request to the backend with the token
    const backendResponse = await fetch(`${BACKEND_URL}${event.url.pathname}`, {
      method: request.method,
      headers: {
        ...Object.fromEntries(request.headers),
        'Authorization': `Bearer ${accessToken}`,
        'Content-Type': 'application/json'
      },
      body
    });

    // Return the backend response
    return new Response(backendResponse.body, {
      status: backendResponse.status,
      headers: backendResponse.headers
    });
  }

  // For non-API requests, proceed normally
  return resolve(event);
}; 