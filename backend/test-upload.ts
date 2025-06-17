#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read

// Test script for photo upload functionality
const BASE_URL = "http://localhost:8000";

// Simple test image (1x1 pixel PNG)
const TEST_IMAGE_BASE64 = "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNkYPhfDwAChwGA60e6kgAAAABJRU5ErkJggg==";

async function testPhotoUpload() {
  try {
    console.log("Testing photo upload...");
    
    // First, we need to get a valid Google token
    // For testing, you'll need to provide a valid token
    const token = Deno.env.get("GOOGLE_TEST_TOKEN");
    if (!token) {
      console.log("Please set GOOGLE_TEST_TOKEN environment variable with a valid Google OAuth token");
      return;
    }

    const response = await fetch(`${BASE_URL}/api/photos/upload`, {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        imageData: TEST_IMAGE_BASE64,
        filename: "test-image.png",
        contentType: "image/png"
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Upload successful!");
      console.log("Photo ID:", result.photoId);
      console.log("Presigned URL:", result.presignedUrl);
      console.log("Status:", result.status);
      console.log("Upload timestamp:", result.uploadTimestamp);
    } else {
      const error = await response.text();
      console.log("❌ Upload failed:", response.status, error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

async function testListPhotos() {
  try {
    console.log("\nTesting photo listing...");
    
    const token = Deno.env.get("GOOGLE_TEST_TOKEN");
    if (!token) {
      console.log("Please set GOOGLE_TEST_TOKEN environment variable");
      return;
    }

    const response = await fetch(`${BASE_URL}/api/photos`, {
      method: "GET",
      headers: {
        "Authorization": `Bearer ${token}`,
      }
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ List successful!");
      console.log("Photos found:", result.photos.length);
      result.photos.forEach((photo: any, index: number) => {
        console.log(`  ${index + 1}. ${photo.photoId} - ${photo.status}`);
      });
    } else {
      const error = await response.text();
      console.log("❌ List failed:", response.status, error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

// Run tests
if (import.meta.main) {
  await testPhotoUpload();
  await testListPhotos();
} 