/**
 * Cloudflare R2 Storage Utilities
 *
 * Handles uploading and retrieving files from R2:
 * - images/{userId}/{designId}.png - Design images
 * - research/{userId}/{designId}.json - Research data for variations
 * - vectors/{userId}/{designId}.svg - Cached vectorized designs
 */

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';

// R2 is S3-compatible
const r2Client = new S3Client({
  region: 'auto',
  endpoint: process.env.R2_ENDPOINT || `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || 'turbomerch';

/**
 * Upload image to R2
 * @param userId - User ID for folder structure
 * @param designId - Design ID for filename
 * @param imageData - Base64 image data or Buffer
 * @returns R2 URL
 */
export async function uploadImage(
  userId: string,
  designId: string,
  imageData: string | Buffer
): Promise<string> {
  try {
    let buffer: Buffer;
    let contentType = 'image/png';

    if (typeof imageData === 'string') {
      // Remove data URI prefix if present
      const base64Match = imageData.match(/^data:([^;]+);base64,(.+)$/);
      if (base64Match) {
        contentType = base64Match[1];
        buffer = Buffer.from(base64Match[2], 'base64');
      } else {
        buffer = Buffer.from(imageData, 'base64');
      }
    } else {
      buffer = imageData;
    }

    const key = `images/${userId}/${designId}.png`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      })
    );

    // Return public URL
    const publicUrl = process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;
    return `${publicUrl}/${key}`;
  } catch (error) {
    console.error('Error uploading image to R2:', error);
    throw new Error('Failed to upload image to R2');
  }
}

/**
 * Upload research data to R2
 * @param userId - User ID for folder structure
 * @param designId - Design ID for filename
 * @param researchData - Research data object
 * @returns R2 URL
 */
export async function uploadResearchData(
  userId: string,
  designId: string,
  researchData: any
): Promise<string> {
  try {
    const key = `research/${userId}/${designId}.json`;
    const buffer = Buffer.from(JSON.stringify(researchData), 'utf-8');

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'application/json',
      })
    );

    const publicUrl = process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;
    return `${publicUrl}/${key}`;
  } catch (error) {
    console.error('Error uploading research data to R2:', error);
    throw new Error('Failed to upload research data to R2');
  }
}

/**
 * Fetch research data from R2
 * @param userId - User ID for folder structure
 * @param designId - Design ID for filename
 * @returns Research data object
 */
export async function fetchResearchData(
  userId: string,
  designId: string
): Promise<any> {
  try {
    const key = `research/${userId}/${designId}.json`;

    const response = await r2Client.send(
      new GetObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );

    if (!response.Body) {
      throw new Error('No data received from R2');
    }

    const bodyString = await response.Body.transformToString();
    return JSON.parse(bodyString);
  } catch (error: any) {
    if (error?.name === 'NoSuchKey' || error?.Code === 'NoSuchKey') {
      return null; // File doesn't exist
    }
    console.error('Error fetching research data from R2:', error);
    throw new Error('Failed to fetch research data from R2');
  }
}

/**
 * Delete image from R2
 * @param userId - User ID for folder structure
 * @param designId - Design ID for filename
 */
export async function deleteImage(userId: string, designId: string): Promise<void> {
  try {
    const key = `images/${userId}/${designId}.png`;
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
  } catch (error) {
    console.error('Error deleting image from R2:', error);
    // Don't throw - deletion failure shouldn't block other operations
  }
}

/**
 * Delete research data from R2
 * @param userId - User ID for folder structure
 * @param designId - Design ID for filename
 */
export async function deleteResearchData(userId: string, designId: string): Promise<void> {
  try {
    const key = `research/${userId}/${designId}.json`;
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
  } catch (error) {
    console.error('Error deleting research data from R2:', error);
    // Don't throw - deletion failure shouldn't block other operations
  }
}

/**
 * Check if research data exists in R2
 * @param userId - User ID for folder structure
 * @param designId - Design ID for filename
 * @returns True if file exists
 */
export async function researchDataExists(userId: string, designId: string): Promise<boolean> {
  try {
    const key = `research/${userId}/${designId}.json`;
    await r2Client.send(
      new HeadObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
    return true;
  } catch (error) {
    return false;
  }
}

/**
 * Upload vectorized image to R2
 * @param userId - User ID for folder structure
 * @param designId - Design ID for filename
 * @param svgData - SVG data as string or Buffer
 * @returns R2 URL
 */
export async function uploadVector(
  userId: string,
  designId: string,
  svgData: string | Buffer
): Promise<string> {
  try {
    const buffer = typeof svgData === 'string' ? Buffer.from(svgData, 'utf-8') : svgData;
    const key = `vectors/${userId}/${designId}.svg`;

    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: buffer,
        ContentType: 'image/svg+xml',
      })
    );

    const publicUrl = process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;
    return `${publicUrl}/${key}`;
  } catch (error) {
    console.error('Error uploading vector to R2:', error);
    throw new Error('Failed to upload vector to R2');
  }
}

/**
 * Generic upload to R2 with custom key
 * @param key - Full path/key for the file (e.g., "vectors/userId/designId_hd.png")
 * @param data - File data as Buffer
 * @param contentType - MIME type of the file
 * @returns R2 URL
 */
export async function uploadToR2(
  key: string,
  data: Buffer,
  contentType: string
): Promise<string> {
  try {
    await r2Client.send(
      new PutObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
        Body: data,
        ContentType: contentType,
        CacheControl: 'public, max-age=31536000',
      })
    );

    return getPublicUrl(key);
  } catch (error) {
    console.error('Error uploading to R2:', error);
    throw new Error('Failed to upload to R2');
  }
}

/**
 * Get public URL for an R2 key
 * @param key - Full path/key for the file
 * @returns Public URL
 */
export function getPublicUrl(key: string): string {
  const publicUrl = process.env.R2_PUBLIC_URL || `https://pub-${process.env.R2_ACCOUNT_ID}.r2.dev`;
  return `${publicUrl}/${key}`;
}

/**
 * Delete file from R2 by key
 * @param key - Full path/key for the file
 */
export async function deleteFromR2(key: string): Promise<void> {
  try {
    await r2Client.send(
      new DeleteObjectCommand({
        Bucket: BUCKET_NAME,
        Key: key,
      })
    );
  } catch (error) {
    console.error('Error deleting from R2:', error);
    // Don't throw - deletion failure shouldn't block other operations
  }
}
