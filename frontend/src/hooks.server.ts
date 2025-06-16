import { env } from '$env/dynamic/private';
import { json } from '@sveltejs/kit';
import type { Handle } from '@sveltejs/kit';

export const handle: Handle = async ({ event, resolve }) => {
  // Get the access token from cookies
  const accessToken = event.cookies.get('access_token');

  // If this is an API request to our backend
  if (event.url.pathname.startsWith('/api/')) {
    // Clone the request
    const request = event.request.clone();
    const body = request.body ? await request.text() : undefined;

    // Build headers from scratch, do NOT forward Authorization from client
    const headers: Record<string, string> = {
      'Content-Type': 'application/json'
    };
    if (accessToken) {
      headers['Authorization'] = `Bearer ${accessToken}`;
    }

    // Forward the request to the backend
    const backendResponse = await fetch(`${env.BACKEND_URL}${event.url.pathname}`, {
      method: request.method,
      headers,
      body
    });

    const data = await backendResponse.json();
    return json(data);
  }

  // For non-API requests, proceed normally
  return resolve(event);
}; 