export interface ErrorResponse {
  error: string;
}

export interface HealthResponse {
  status: string;
}

export interface UserInfo {
  email: string;
  name: string;
  given_name?: string;
  family_name?: string;
  picture?: string;
}

export interface PhotoUploadResponse {
  photoId: string;
  uploadUrl: string; // Pre-signed S3 URL for direct upload
  status: 'pending' | 'processing' | 'completed' | 'failed';
}

export interface PhotoMetadata {
  photoId: string;
  userId: string;
  s3Key: string;
  uploadTimestamp: string;
  status: 'pending' | 'processing' | 'completed' | 'failed';
  title?: string; // AI-generated title
  description?: string; // AI-generated description
  processingError?: string;
  lookupKey?: string; // Compound sort key for direct DynamoDB lookups
}

export interface PhotoListResponse {
  photos: PhotoMetadata[];
  nextToken?: string; // For pagination
}
