# Photo Upload API

This document describes the photo upload API that handles direct image upload to S3 and metadata storage in DynamoDB.

## Overview

The photo upload API provides two endpoints:
1. **Direct Upload** (`POST /api/photos/upload`) - Upload image data directly to S3
2. **Presigned URL** (`POST /api/photos/upload-url`) - Generate presigned URL for client-side upload

## Direct Upload Endpoint

### `POST /api/photos/upload`

Uploads an image directly to S3 and stores metadata in DynamoDB.

#### Request

**Headers:**
```
Authorization: Bearer <google_oauth_token>
Content-Type: application/json
```

**Body:**
```json
{
  "imageData": "base64_encoded_image_data",
  "filename": "photo.jpg",
  "contentType": "image/jpeg"
}
```

**Parameters:**
- `imageData` (string, required): Base64 encoded image data (with or without data URL prefix)
- `filename` (string, required): Original filename of the image
- `contentType` (string, required): MIME type of the image (must start with "image/")

#### Response

**Success (200):**
```json
{
  "photoId": "a1b2c3d4e5f6",
  "userId": "user@example.com",
  "s3Key": "user@example.com/a1b2c3d4e5f6/photo.jpg",
  "uploadTimestamp": "2024-01-15T10:30:00.000Z",
  "status": "completed",
  "presignedUrl": "https://s3.amazonaws.com/bucket/key?signature..."
}
```

**Error (400):**
```json
{
  "error": "Image data, filename, and content type are required"
}
```

**Error (401):**
```json
{
  "error": "Authentication required"
}
```

#### Example Usage

```javascript
// Convert image file to base64
const file = document.getElementById('imageInput').files[0];
const reader = new FileReader();
reader.onload = async function() {
  const base64Data = reader.result.split(',')[1]; // Remove data URL prefix
  
  const response = await fetch('/api/photos/upload', {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${googleToken}`,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      imageData: base64Data,
      filename: file.name,
      contentType: file.type
    })
  });
  
  const result = await response.json();
  console.log('Uploaded photo ID:', result.photoId);
  console.log('View URL:', result.presignedUrl);
};
reader.readAsDataURL(file);
```

## Presigned URL Endpoint

### `POST /api/photos/upload-url`

Generates a presigned URL for client-side upload to S3.

#### Request

**Headers:**
```
Authorization: Bearer <google_oauth_token>
Content-Type: application/json
```

**Body:**
```json
{
  "filename": "photo.jpg",
  "contentType": "image/jpeg"
}
```

#### Response

**Success (200):**
```json
{
  "photoId": "a1b2c3d4e5f6",
  "uploadUrl": "https://s3.amazonaws.com/bucket/key?signature...",
  "status": "pending"
}
```

## Get Photo URL Endpoint

### `GET /api/photos/:photoId/url`

Generates a presigned URL for viewing a specific photo.

#### Request

**Headers:**
```
Authorization: Bearer <google_oauth_token>
```

#### Response

**Success (200):**
```json
{
  "presignedUrl": "https://s3.amazonaws.com/bucket/key?signature..."
}
```

## Data Flow

1. **Direct Upload:**
   ```
   Client → API → S3 Upload → DynamoDB Metadata → Return PhotoMetadata + Presigned URL
   ```

2. **Presigned URL:**
   ```
   Client → API → Generate Presigned URL → Client → S3 Upload
   ```

## Storage Structure

### S3 Bucket
```
bucket/
├── user@example.com/
│   ├── photoId1/
│   │   └── original-filename.jpg
│   └── photoId2/
│       └── another-photo.png
```

### DynamoDB Table
```json
{
  "photoId": "a1b2c3d4e5f6",
  "userId": "user@example.com",
  "s3Key": "user@example.com/a1b2c3d4e5f6/photo.jpg",
  "uploadTimestamp": "2024-01-15T10:30:00.000Z",
  "status": "completed",
  "description": "AI-generated description (optional)",
  "processingError": "Error message if processing failed (optional)"
}
```

## Supported Image Types

- JPEG (`image/jpeg`)
- PNG (`image/png`)
- GIF (`image/gif`)
- WebP (`image/webp`)
- Any other MIME type starting with `image/`

## Error Handling

- **Invalid image data**: Returns 400 with error message
- **Missing authentication**: Returns 401
- **S3 upload failure**: Returns 500
- **DynamoDB write failure**: Returns 500

## Testing

Use the provided test script:

```bash
# Set your Google OAuth token
export GOOGLE_TEST_TOKEN="your_token_here"

# Run the test
deno run --allow-net --allow-env --allow-read test-upload.ts
```

## Security Considerations

- All endpoints require valid Google OAuth authentication
- Images are stored in user-specific S3 folders
- Presigned URLs expire after 1 hour
- Content type validation prevents non-image uploads
- Base64 decoding includes error handling 