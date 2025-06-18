export interface PhotoMetadata {
  photoId: string;
  userId: string;
  s3Key: string;
  uploadTimestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  title?: string;
  description?: string;
  processingError?: string;
  lookupKey?: string;
  presignedUrl?: string;
}

export interface PhotoListResponse {
  photos: PhotoMetadata[];
  nextToken?: string;
}

export interface PhotoStatusResponse {
  photoId: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  uploadTimestamp: string;
  title?: string;
  description?: string;
  processingError?: string;
}

export interface PhotoUrlResponse {
  presignedUrl: string;
}

const API_BASE = '/api/photos';

// Helper function to make authenticated API calls
async function apiCall(endpoint: string, options: RequestInit = {}): Promise<Response> {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!response.ok) {
    const error = await response.text();
    throw new Error(`API call failed: ${response.status} - ${error}`);
  }

  return response;
}

// Upload a photo
export async function uploadPhoto(file: File): Promise<PhotoMetadata> {
  // Convert file to base64 using FileReader
  const base64 = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      // reader.result is a data URL: "data:image/png;base64,...."
      const result = reader.result as string;
      // Strip the prefix to get only the base64 data
      const base64Data = result.replace(/^data:image\/[a-zA-Z0-9+.-]+;base64,/, '');
      resolve(base64Data);
    };
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });

  const response = await apiCall('/upload', {
    method: 'POST',
    body: JSON.stringify({
      imageData: base64,
      filename: file.name,
      contentType: file.type
    })
  });

  return response.json();
}

// List user's photos
export async function listPhotos(pageSize: number = 20, nextToken?: string): Promise<PhotoListResponse> {
  const params = new URLSearchParams();
  params.append('pageSize', pageSize.toString());
  if (nextToken) {
    params.append('nextToken', nextToken);
  }

  const response = await apiCall(`/?${params.toString()}`);
  return response.json();
}

// Get photo status
export async function getPhotoStatus(lookupKey: string): Promise<PhotoStatusResponse> {
  const encodedLookupKey = encodeURIComponent(lookupKey);
  const response = await apiCall(`/${encodedLookupKey}/status`);
  return response.json();
}

// Get presigned URL for viewing a photo
export async function getPhotoUrl(lookupKey: string): Promise<PhotoUrlResponse> {
  const encodedLookupKey = encodeURIComponent(lookupKey);
  const response = await apiCall(`/${encodedLookupKey}/url`);
  return response.json();
}

// Delete a photo
export async function deletePhoto(lookupKey: string): Promise<void> {
  const encodedLookupKey = encodeURIComponent(lookupKey);
  await apiCall(`/${encodedLookupKey}`, {
    method: 'DELETE'
  });
}

// Validate if a file is an image
export function validateImageFile(file: File): { valid: boolean; error?: string } {
  // Check file type
  if (!file.type.startsWith('image/')) {
    return { valid: false, error: 'File must be an image' };
  }

  // Check file size (max 10MB)
  const maxSize = 10 * 1024 * 1024; // 10MB
  if (file.size > maxSize) {
    return { valid: false, error: 'File size must be less than 10MB' };
  }

  // Check file extension
  const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
  const fileExtension = file.name.toLowerCase().substring(file.name.lastIndexOf('.'));
  if (!allowedExtensions.includes(fileExtension)) {
    return { valid: false, error: 'File must be a JPG, PNG, GIF, or WebP image' };
  }

  return { valid: true };
} 