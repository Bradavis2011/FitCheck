import { describe, it, expect, beforeEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockLogCreate = vi.hoisted(() => vi.fn());
const mockLogUpdate = vi.hoisted(() => vi.fn());
const mockLogFindMany = vi.hoisted(() => vi.fn());
const mockS3Send = vi.hoisted(() => vi.fn());
const mockClerkDeleteUser = vi.hoisted(() => vi.fn());
const mockFetch = vi.hoisted(() => vi.fn());

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    dataDeletionLog: {
      create: mockLogCreate,
      update: mockLogUpdate,
      findMany: mockLogFindMany,
    },
  },
}));

vi.mock('@aws-sdk/client-s3', () => ({
  S3Client: class {
    send = mockS3Send;
  },
  ListObjectsV2Command: class {},
  DeleteObjectsCommand: class {},
}));

vi.mock('@clerk/express', () => ({
  createClerkClient: vi.fn().mockImplementation(() => ({
    users: { deleteUser: mockClerkDeleteUser },
  })),
}));

// Stub the global fetch used for PostHog deletion
vi.stubGlobal('fetch', mockFetch);

import { initiateDataDeletion, retryFailedDeletions } from '../data-deletion.service.js';

// ─── Helpers ──────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockLogCreate.mockReset();
  mockLogUpdate.mockReset();
  mockLogFindMany.mockReset();
  mockS3Send.mockReset();
  mockClerkDeleteUser.mockReset();
  mockFetch.mockReset();

  // Default: log creation succeeds
  mockLogCreate.mockResolvedValue({ id: 'log-1' });
  mockLogUpdate.mockResolvedValue({});

  // Default: S3 returns empty listing (no images to delete)
  mockS3Send.mockResolvedValue({ Contents: [] });

  // Default: Clerk deletes successfully
  mockClerkDeleteUser.mockResolvedValue(undefined);

  // Default: PostHog returns 200 OK
  mockFetch.mockResolvedValue({ ok: true });
});

function setupS3Env() {
  vi.stubEnv('AWS_S3_BUCKET', 'fitcheck-images');
  vi.stubEnv('AWS_REGION', 'us-east-1');
  vi.stubEnv('AWS_ACCESS_KEY_ID', 'AKIA_TEST');
  vi.stubEnv('AWS_SECRET_ACCESS_KEY', 'secret');
}

function setupPostHogEnv() {
  vi.stubEnv('POSTHOG_API_KEY', 'phc_test');
}

function setupClerkEnv() {
  vi.stubEnv('CLERK_SECRET_KEY', 'sk_test');
}

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('initiateDataDeletion', () => {
  it('creates a DataDeletionLog with status "pending" at the start', async () => {
    await initiateDataDeletion('user-1', 'user@example.com');

    expect(mockLogCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          userEmail: 'user@example.com',
          status: 'pending',
        }),
      }),
    );
  });

  it('aborts gracefully if log creation fails', async () => {
    mockLogCreate.mockRejectedValue(new Error('DB error'));

    // Should not throw
    await expect(initiateDataDeletion('user-1', 'user@example.com')).resolves.toBeUndefined();

    expect(mockLogUpdate).not.toHaveBeenCalled();
  });

  describe('S3 deletion step', () => {
    it('marks s3_images step as "skipped" (throws "S3 not configured") when env vars are missing', async () => {
      vi.stubEnv('AWS_S3_BUCKET', '');

      await initiateDataDeletion('user-1', 'user@example.com');

      const updateCall = mockLogUpdate.mock.calls[0][0];
      const steps = updateCall.data.stepsCompleted as Array<{ step: string; status: string }>;
      const s3Step = steps.find(s => s.step === 's3_images');

      expect(s3Step).toBeDefined();
      expect(s3Step!.status).toBe('failed'); // throws → caught as failed
      vi.unstubAllEnvs();
    });

    it('marks s3_images step as "done" when S3 is configured and deletion succeeds', async () => {
      setupS3Env();
      setupClerkEnv();
      setupPostHogEnv();
      // S3 listing returns no objects → deletion is a no-op
      mockS3Send.mockResolvedValue({ Contents: [] });

      await initiateDataDeletion('user-1', 'user@example.com');

      const updateCall = mockLogUpdate.mock.calls[0][0];
      const steps = updateCall.data.stepsCompleted as Array<{ step: string; status: string }>;
      const s3Step = steps.find(s => s.step === 's3_images');

      expect(s3Step!.status).toBe('done');
      vi.unstubAllEnvs();
    });
  });

  describe('Clerk deletion step', () => {
    it('marks clerk_deletion as "done" when Clerk delete succeeds', async () => {
      setupClerkEnv();
      setupPostHogEnv();

      await initiateDataDeletion('user-1', 'user@example.com');

      const updateCall = mockLogUpdate.mock.calls[0][0];
      const steps = updateCall.data.stepsCompleted as Array<{ step: string; status: string }>;
      const clerkStep = steps.find(s => s.step === 'clerk_deletion');

      expect(clerkStep!.status).toBe('done');
      vi.unstubAllEnvs();
    });

    it('marks clerk_deletion as "failed" when Clerk throws', async () => {
      setupClerkEnv();
      setupPostHogEnv();
      mockClerkDeleteUser.mockRejectedValue(new Error('Clerk 404'));

      await initiateDataDeletion('user-1', 'user@example.com');

      const updateCall = mockLogUpdate.mock.calls[0][0];
      const steps = updateCall.data.stepsCompleted as Array<{ step: string; status: string; error?: string }>;
      const clerkStep = steps.find(s => s.step === 'clerk_deletion');

      expect(clerkStep!.status).toBe('failed');
      expect(clerkStep!.error).toContain('Clerk 404');
      vi.unstubAllEnvs();
    });
  });

  describe('PostHog deletion step', () => {
    it('marks posthog_deletion as "done" when PostHog returns 200', async () => {
      setupClerkEnv();
      setupPostHogEnv();
      mockFetch.mockResolvedValue({ ok: true });

      await initiateDataDeletion('user-1', 'user@example.com');

      const updateCall = mockLogUpdate.mock.calls[0][0];
      const steps = updateCall.data.stepsCompleted as Array<{ step: string; status: string }>;
      const phStep = steps.find(s => s.step === 'posthog_deletion');

      expect(phStep!.status).toBe('done');
      vi.unstubAllEnvs();
    });

    it('marks posthog_deletion as "failed" when POSTHOG_API_KEY is missing', async () => {
      setupClerkEnv();
      vi.stubEnv('POSTHOG_API_KEY', '');

      await initiateDataDeletion('user-1', 'user@example.com');

      const updateCall = mockLogUpdate.mock.calls[0][0];
      const steps = updateCall.data.stepsCompleted as Array<{ step: string; status: string }>;
      const phStep = steps.find(s => s.step === 'posthog_deletion');

      expect(phStep!.status).toBe('failed');
      vi.unstubAllEnvs();
    });
  });

  describe('final status', () => {
    it('sets final status to "completed" when 0 or 1 step fails', async () => {
      setupClerkEnv();
      setupPostHogEnv();
      // S3 not configured → 1 failed step. Clerk + PostHog OK.
      vi.stubEnv('AWS_S3_BUCKET', '');

      await initiateDataDeletion('user-1', 'user@example.com');

      const updateCall = mockLogUpdate.mock.calls[0][0];
      expect(updateCall.data.status).toBe('completed');
      vi.unstubAllEnvs();
    });

    it('sets final status to "failed" when 3 or more steps fail', async () => {
      // All env vars missing → S3, Clerk (no secret key still creates client but delete fails), PostHog fail
      vi.stubEnv('AWS_S3_BUCKET', '');
      vi.stubEnv('POSTHOG_API_KEY', '');
      mockClerkDeleteUser.mockRejectedValue(new Error('Clerk error'));

      await initiateDataDeletion('user-1', 'user@example.com');

      const updateCall = mockLogUpdate.mock.calls[0][0];
      expect(updateCall.data.status).toBe('failed');
      vi.unstubAllEnvs();
    });

    it('always marks prisma_cascade step as "done" (already completed before call)', async () => {
      setupClerkEnv();
      setupPostHogEnv();

      await initiateDataDeletion('user-1', 'user@example.com');

      const updateCall = mockLogUpdate.mock.calls[0][0];
      const steps = updateCall.data.stepsCompleted as Array<{ step: string; status: string }>;
      const cascadeStep = steps.find(s => s.step === 'prisma_cascade');

      expect(cascadeStep!.status).toBe('done');
      vi.unstubAllEnvs();
    });
  });
});

describe('retryFailedDeletions', () => {
  it('does nothing when there are no failed logs', async () => {
    mockLogFindMany.mockResolvedValue([]);

    await retryFailedDeletions();

    // No deletion attempts
    expect(mockLogCreate).not.toHaveBeenCalled();
  });

  it('re-runs initiateDataDeletion for each failed log', async () => {
    mockLogFindMany.mockResolvedValue([
      { id: 'log-1', userId: 'user-a', userEmail: 'a@example.com' },
      { id: 'log-2', userId: 'user-b', userEmail: 'b@example.com' },
    ]);
    // Each retry creates a new log entry
    mockLogCreate.mockResolvedValue({ id: 'retry-log' });

    await retryFailedDeletions();

    // Two retry attempts → two new log entries
    expect(mockLogCreate).toHaveBeenCalledTimes(2);
  });

  it('handles DB query failure gracefully without throwing', async () => {
    mockLogFindMany.mockRejectedValue(new Error('DB unavailable'));

    // Should resolve without throwing
    await expect(retryFailedDeletions()).resolves.toBeUndefined();
  });
});
