import { S3Client, PutObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';

// Check if S3 is configured
export function isConfigured(): boolean {
  return !!(
    process.env.AWS_REGION &&
    process.env.AWS_ACCESS_KEY_ID &&
    process.env.AWS_SECRET_ACCESS_KEY &&
    process.env.AWS_S3_BUCKET
  );
}

// Lazy initialization of S3 client
let s3Client: S3Client | null = null;

function getS3Client(): S3Client {
  if (!isConfigured()) {
    throw new Error(
      'S3 is not configured. Missing required environment variables: AWS_REGION, AWS_ACCESS_KEY_ID, AWS_SECRET_ACCESS_KEY, AWS_S3_BUCKET'
    );
  }

  if (!s3Client) {
    const config: any = {
      region: process.env.AWS_REGION!,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID!,
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY!,
      },
    };

    // Support Cloudflare R2 custom endpoint
    if (process.env.AWS_ENDPOINT) {
      config.endpoint = process.env.AWS_ENDPOINT;
      config.forcePathStyle = true; // Required for R2
    }

    s3Client = new S3Client(config);
  }

  return s3Client;
}

const BUCKET_NAME = process.env.AWS_S3_BUCKET || 'fitcheck-images';

/**
 * Uploads a buffer to S3 and returns the public URL
 * @throws Error if S3 is not configured
 */
export async function uploadBuffer(
  buffer: Buffer,
  key: string,
  contentType: string
): Promise<string> {
  const client = getS3Client(); // Will throw if not configured

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
    Body: buffer,
    ContentType: contentType,
  });

  await client.send(command);

  // Return public URL (assumes bucket has public read access)
  // For Cloudflare R2, use public domain if configured, otherwise use R2 dev domain
  if (process.env.AWS_ENDPOINT) {
    // Cloudflare R2: https://pub-<id>.r2.dev/<key> or custom domain
    const publicDomain = process.env.R2_PUBLIC_DOMAIN ||
      `https://pub-${process.env.AWS_ENDPOINT.split('//')[1].split('.')[0]}.r2.dev`;
    return `${publicDomain}/${key}`;
  }

  // AWS S3: standard URL format
  return `https://${BUCKET_NAME}.s3.${process.env.AWS_REGION}.amazonaws.com/${key}`;
}

/**
 * Deletes an object from S3
 * @throws Error if S3 is not configured
 */
export async function deleteObject(key: string): Promise<void> {
  const client = getS3Client(); // Will throw if not configured

  const command = new DeleteObjectCommand({
    Bucket: BUCKET_NAME,
    Key: key,
  });

  await client.send(command);
}
