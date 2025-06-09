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
