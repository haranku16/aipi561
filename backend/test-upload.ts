#!/usr/bin/env -S deno run --allow-net --allow-env --allow-read --allow-run

// Test script for photo upload functionality
const BASE_URL = "http://localhost:8000";

async function readImageAsBase64(): Promise<string> {
  try {
    const imageBytes = await Deno.readFile("test-upload-image.jpg");
    // Convert Uint8Array to base64 using a more efficient method
    let binary = '';
    const len = imageBytes.byteLength;
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(imageBytes[i]);
    }
    const base64 = btoa(binary);
    return base64;
  } catch (error) {
    console.error("Failed to read image file:", error);
    throw error;
  }
}

async function testPhotoUpload() {
  try {
    console.log("Testing photo upload...");
    
    // Read the actual image file
    const imageBase64 = await readImageAsBase64();
    
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
        imageData: imageBase64,
        filename: "test-upload-image.jpg",
        contentType: "image/jpeg"
      })
    });

    if (response.ok) {
      const result = await response.json();
      console.log("✅ Upload successful!");
      console.log("Photo ID:", result.photoId);
      console.log("Presigned URL:", result.presignedUrl);
      console.log("Status:", result.status);
      console.log("Upload timestamp:", result.uploadTimestamp);
      if (result.lookupKey) {
        console.log("Lookup Key:", result.lookupKey);
      }
      return result.lookupKey; // Return lookupKey for status checking
    } else {
      const error = await response.text();
      console.log("❌ Upload failed:", response.status, error);
      return null;
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
    return null;
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
        if (photo.lookupKey) {
          console.log(`     Lookup Key: ${photo.lookupKey}`);
        }
      });
    } else {
      const error = await response.text();
      console.log("❌ List failed:", response.status, error);
    }
  } catch (error) {
    console.error("❌ Test failed:", error);
  }
}

async function checkPhotoStatus(lookupKey: string, maxWaitTime: number = 30000, checkInterval: number = 5000): Promise<boolean> {
  try {
    console.log(`\n🔍 Checking processing status for photo with lookupKey ${lookupKey}...`);
    console.log(`⏱️  Will check every ${checkInterval/1000}s for up to ${maxWaitTime/1000}s`);
    
    const token = Deno.env.get("GOOGLE_TEST_TOKEN");
    if (!token) {
      console.log("❌ No token available for status check");
      return false;
    }

    const startTime = Date.now();
    let attempts = 0;

    while (Date.now() - startTime < maxWaitTime) {
      attempts++;
      console.log(`\n📊 Status check attempt ${attempts}...`);
      
      const encodedLookupKey = encodeURIComponent(lookupKey);
      const url = `${BASE_URL}/api/photos/${encodedLookupKey}/status`;
      console.log(`   URL: ${url}`);
      
      const response = await fetch(url, {
        method: "GET",
        headers: {
          "Authorization": `Bearer ${token}`,
        }
      });

      if (response.ok) {
        const result = await response.json();
        console.log(`   Status: ${result.status}`);
        
        if (result.title) {
          console.log(`   Title: ${result.title}`);
        }
        if (result.description) {
          console.log(`   Description: ${result.description}`);
        }
        if (result.processingError) {
          console.log(`   ❌ Processing Error: ${result.processingError}`);
          return false;
        }
        
        if (result.status === "completed") {
          console.log("✅ Photo processing completed successfully!");
          return true;
        } else if (result.status === "pending") {
          console.log("⏳ Photo is still being processed...");
        } else {
          console.log(`ℹ️  Photo status: ${result.status}`);
        }
      } else {
        const error = await response.text();
        console.log(`❌ Status check failed: ${response.status} - ${error}`);
        return false;
      }

      // Wait before next check (except on the last iteration)
      if (Date.now() - startTime + checkInterval < maxWaitTime) {
        console.log(`⏰ Waiting ${checkInterval/1000}s before next check...`);
        await new Promise(resolve => setTimeout(resolve, checkInterval));
      }
    }

    console.log("⏰ Timeout reached - photo processing did not complete within the expected time");
    return false;
  } catch (error) {
    console.error("❌ Status check failed:", error);
    return false;
  }
}

// Run tests
if (import.meta.main) {
  const lookupKey = await testPhotoUpload();
  if (lookupKey) {
    await checkPhotoStatus(lookupKey);
  }
  await testListPhotos();
} 