export interface MapUploadResponse {
  message: string;
  filename: string;
  size: number;
  mapId: string;
}

export interface MapAnalysisRequest {
  mapId: string;
  coordinates?: {
    latitude: number;
    longitude: number;
  }[];
}

export interface MapAnalysisResponse {
  message: string;
  mapId: string;
  currentLocation: {
    x: number; // pixel x coordinate on the map image
    y: number; // pixel y coordinate on the map image
  };
  mapImage: string; // base64 encoded image
  mapScale: {
    pixelsPerMeter: number; // how many pixels represent 1 meter in the real world
    referenceDistance: number; // the real-world distance in meters that the scale is based on
  };
}

export interface ErrorResponse {
  error: string;
}

export interface HealthResponse {
  status: string;
}

export interface UserInfo {
  email: string;
  name: string;
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
  description?: string; // AI-generated description
  processingError?: string;
}

export interface PhotoListResponse {
  photos: PhotoMetadata[];
  nextToken?: string; // For pagination
}

export interface PhotoSearchRequest {
  query: string;
  pageSize?: number;
  nextToken?: string;
}

export interface PhotoSearchResponse {
  results: Array<PhotoMetadata & { score: number }>;
  nextToken?: string;
}
