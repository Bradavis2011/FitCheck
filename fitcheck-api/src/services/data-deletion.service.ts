/**
 * Data Deletion Service
 *
 * Orchestrates GDPR-compliant account deletion across all systems.
 * Called from user.controller.ts after the Prisma cascade delete.
 * All steps are best-effort — failures are logged but never thrown.
 */

import { S3Client, ListObjectsV2Command, DeleteObjectsCommand } from '@aws-sdk/client-s3';
import { createClerkClient } from '@clerk/express';
import { prisma } from '../utils/prisma.js';

type StepResult = { step: string; status: 'done' | 'skipped' | 'failed'; error?: string };

// ─── S3 Folder Deletion ───────────────────────────────────────────────────────

async function deleteS3Folder(userId: string): Promise<void> {
  const bucket = process.env.AWS_S3_BUCKET;
  const region = process.env.AWS_REGION;
  const accessKeyId = process.env.AWS_ACCESS_KEY_ID;
  const secretAccessKey = process.env.AWS_SECRET_ACCESS_KEY;

  if (!bucket || !region || !accessKeyId || !secretAccessKey) {
    throw new Error('S3 not configured');
  }

  const config: any = {
    region,
    credentials: { accessKeyId, secretAccessKey },
  };
  if (process.env.AWS_ENDPOINT) {
    config.endpoint = process.env.AWS_ENDPOINT;
    config.forcePathStyle = true;
  }

  const client = new S3Client(config);
  const prefix = `outfits/${userId}/`;

  // List all objects under the user prefix
  const listed = await client.send(new ListObjectsV2Command({ Bucket: bucket, Prefix: prefix }));
  const objects = listed.Contents ?? [];

  if (objects.length === 0) return;

  await client.send(
    new DeleteObjectsCommand({
      Bucket: bucket,
      Delete: { Objects: objects.map(o => ({ Key: o.Key! })) },
    })
  );
}

// ─── PostHog Deletion ─────────────────────────────────────────────────────────

async function sendPostHogDeletion(userId: string): Promise<void> {
  const apiKey = process.env.POSTHOG_API_KEY;
  if (!apiKey) throw new Error('POSTHOG_API_KEY not set');

  const body = JSON.stringify({
    api_key: apiKey,
    event: '$delete',
    distinct_id: userId,
    properties: {},
  });

  const res = await fetch('https://app.posthog.com/capture/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body,
    signal: AbortSignal.timeout(8000),
  });

  if (!res.ok) throw new Error(`PostHog returned ${res.status}`);
}

// ─── Main Orchestrator ────────────────────────────────────────────────────────

export async function initiateDataDeletion(userId: string, userEmail: string): Promise<void> {
  let logId: string | null = null;

  try {
    const log = await prisma.dataDeletionLog.create({
      data: { userId, userEmail, status: 'pending', stepsCompleted: [] },
    });
    logId = log.id;
  } catch (err) {
    console.error('[DataDeletion] Failed to create log entry:', err);
    return;
  }

  const steps: StepResult[] = [];
  let failCount = 0;

  // Step 1: prisma_cascade — already done by user.controller.ts before calling us
  steps.push({ step: 'prisma_cascade', status: 'done' });

  // Step 2: S3 images
  try {
    await deleteS3Folder(userId);
    steps.push({ step: 's3_images', status: 'done' });
  } catch (err: any) {
    console.error('[DataDeletion] S3 deletion failed:', err?.message);
    steps.push({ step: 's3_images', status: 'failed', error: String(err?.message) });
    failCount++;
  }

  // Step 3: Clerk user deletion
  try {
    const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });
    await clerk.users.deleteUser(userId);
    steps.push({ step: 'clerk_deletion', status: 'done' });
  } catch (err: any) {
    console.error('[DataDeletion] Clerk deletion failed:', err?.message);
    steps.push({ step: 'clerk_deletion', status: 'failed', error: String(err?.message) });
    failCount++;
  }

  // Step 4: PostHog deletion event
  try {
    await sendPostHogDeletion(userId);
    steps.push({ step: 'posthog_deletion', status: 'done' });
  } catch (err: any) {
    console.error('[DataDeletion] PostHog deletion failed:', err?.message);
    steps.push({ step: 'posthog_deletion', status: 'failed', error: String(err?.message) });
    failCount++;
  }

  // Step 5: Intelligence bus entries — skip (userId already deleted from User table; cascades handled)
  steps.push({ step: 'bus_entries', status: 'skipped' });

  const finalStatus = failCount >= 3 ? 'failed' : 'completed';

  try {
    await prisma.dataDeletionLog.update({
      where: { id: logId! },
      data: { status: finalStatus, stepsCompleted: steps as any, completedAt: new Date() },
    });
  } catch (err) {
    console.error('[DataDeletion] Failed to update log entry:', err);
  }
}

// ─── Daily Retry for Failed Logs ──────────────────────────────────────────────

export async function retryFailedDeletions(): Promise<void> {
  const failedLogs: Array<{ id: string; userId: string; userEmail: string }> =
    await prisma.dataDeletionLog.findMany({
      where: { status: 'failed' },
      take: 20,
    }).catch((err: unknown) => {
      console.error('[DataDeletion] retryFailedDeletions query failed:', err);
      return [];
    });

  for (const log of failedLogs) {
    console.log(`[DataDeletion] Retrying deletion for ${log.userEmail} (log ${log.id})`);
    await initiateDataDeletion(log.userId, log.userEmail);
  }
}
