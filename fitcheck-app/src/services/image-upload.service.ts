/**
 * Image Upload Service
 *
 * Handles image compression and conversion for the outfit check flow.
 * Images are sent as base64 to the backend, which stores them in S3.
 */

import { File } from 'expo-file-system';
import { manipulateAsync, SaveFormat } from 'expo-image-manipulator';

export interface ImageUploadResult {
  url: string;
  base64: string;
  width: number;
  height: number;
}

/**
 * Upload an image to cloud storage
 * @param localUri - Local file URI from camera or image picker
 * @returns Public URL of the uploaded image
 */
export async function uploadImage(localUri: string): Promise<ImageUploadResult> {
  try {
    console.log('[ImageUpload] Starting upload for URI:', localUri);

    // Validate URI
    if (!localUri || localUri.trim() === '') {
      throw new Error('Invalid image URI');
    }

    // Step 1: Compress and optimize the image
    console.log('[ImageUpload] Compressing image...');
    const optimized = await manipulateAsync(
      localUri,
      [{ resize: { width: 1080 } }], // Max width 1080px
      {
        compress: 0.8,
        format: SaveFormat.JPEG,
      }
    );
    console.log('[ImageUpload] Image compressed:', optimized.width, 'x', optimized.height);

    // Step 2: Convert to base64 for backend storage (using new File API)
    console.log('[ImageUpload] Converting to base64...');
    const file = new File(optimized.uri);
    const base64 = await file.base64();
    console.log('[ImageUpload] Base64 conversion complete, size:', base64.length, 'chars');

    // Return both local URI (for display) and base64 (for API)
    return {
      url: optimized.uri,
      base64: base64,
      width: optimized.width,
      height: optimized.height,
    };
  } catch (error: any) {
    console.error('[ImageUpload] Image upload failed:', error);
    console.error('[ImageUpload] Error details:', {
      name: error.name,
      message: error.message,
      uri: localUri,
    });
    throw new Error(`Failed to process image: ${error.message || 'Unknown error'}`);
  }
}

/**
 * Convert image to base64
 */
export async function imageToBase64(uri: string): Promise<string> {
  try {
    const file = new File(uri);
    const base64 = await file.base64();
    return `data:image/jpeg;base64,${base64}`;
  } catch (error) {
    console.error('Failed to convert image to base64:', error);
    throw error;
  }
}
