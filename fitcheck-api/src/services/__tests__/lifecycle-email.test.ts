import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockEmailSeqFindMany = vi.hoisted(() => vi.fn());
const mockEmailSeqFindUnique = vi.hoisted(() => vi.fn());
const mockEmailSeqCreate = vi.hoisted(() => vi.fn());
const mockEmailSeqUpdate = vi.hoisted(() => vi.fn());
const mockUserFindUnique = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockOutfitFindMany = vi.hoisted(() => vi.fn());
const mockOutfitFindFirst = vi.hoisted(() => vi.fn());
const mockEmailEventGroupBy = vi.hoisted(() => vi.fn());
const mockEmailVariantFindMany = vi.hoisted(() => vi.fn());
const mockEmailVariantFindFirst = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());
const mockExecuteOrQueue = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    emailSequence: {
      findMany: mockEmailSeqFindMany,
      findUnique: mockEmailSeqFindUnique,
      create: mockEmailSeqCreate,
      update: mockEmailSeqUpdate,
    },
    user: {
      findUnique: mockUserFindUnique,
      findMany: mockUserFindMany,
    },
    outfitCheck: {
      findMany: mockOutfitFindMany,
      findFirst: mockOutfitFindFirst,
    },
    emailTemplateVariant: {
      findMany: mockEmailVariantFindMany,
      findFirst: mockEmailVariantFindFirst,
    },
    styleDNA: {
      findMany: vi.fn().mockResolvedValue([]),
    },
    emailEvent: {
      groupBy: mockEmailEventGroupBy,
      create: vi.fn().mockResolvedValue({}),
    },
  },
}));

vi.mock('../agent-manager.service.js', () => ({
  executeOrQueue: mockExecuteOrQueue,
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runLifecycleEmail, triggerUpgradeSequence } from '../lifecycle-email.service.js';

// ─── Test Constants ───────────────────────────────────────────────────────────

const ACTIVE_SEQUENCE = {
  id: 'seq-1',
  userId: 'user-1',
  sequence: 'welcome',
  currentStep: 0,
  status: 'active',
  nextSendAt: new Date(Date.now() - 1000), // past due
};

const ACTIVE_USER = {
  id: 'user-1',
  email: 'alice@example.com',
  name: 'Alice',
  emailOptOut: false,
  unsubscribeToken: 'tok-abc',
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  // processDueSequences — due sequences list (empty by default)
  mockEmailSeqFindMany.mockResolvedValue([]);
  // triggerNewSequences dedup + triggerUpgradeSequence dedup
  mockEmailSeqFindUnique.mockResolvedValue(null);
  mockEmailSeqCreate.mockResolvedValue({ id: 'seq-new' });
  mockEmailSeqUpdate.mockResolvedValue({});
  // processDueSequences — user lookup
  mockUserFindUnique.mockResolvedValue(ACTIVE_USER);
  // triggerNewSequences — new users + paid inactive users
  mockUserFindMany.mockResolvedValue([]);
  // triggerNewSequences — onboarding + reengagement
  mockOutfitFindMany.mockResolvedValue([]);
  mockOutfitFindFirst.mockResolvedValue(null);
  // publishEmailMetrics
  mockEmailEventGroupBy.mockResolvedValue([]);
  // getVariantSubject — no variants, use default subject
  mockEmailVariantFindMany.mockResolvedValue([]);
  mockEmailVariantFindFirst.mockResolvedValue(null);

  mockExecuteOrQueue.mockResolvedValue(undefined);
  mockPublishBus.mockResolvedValue(undefined);

  vi.stubEnv('RESEND_API_KEY', 're_test');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runLifecycleEmail ────────────────────────────────────────────────────────

describe('runLifecycleEmail', () => {
  describe('processDueSequences', () => {
    it('does not process sequences when RESEND_API_KEY is not set', async () => {
      vi.stubEnv('RESEND_API_KEY', '');
      // Even if there are due sequences, processDueSequences returns early before
      // calling emailSequence.findMany — so executeOrQueue must never be called
      await runLifecycleEmail();
      expect(mockExecuteOrQueue).not.toHaveBeenCalled();
    });

    it('cancels sequence for opted-out user — GDPR compliance', async () => {
      mockEmailSeqFindMany.mockResolvedValue([ACTIVE_SEQUENCE]);
      mockUserFindUnique.mockResolvedValue({ ...ACTIVE_USER, emailOptOut: true });

      await runLifecycleEmail();

      expect(mockEmailSeqUpdate).toHaveBeenCalledWith({
        where: { id: 'seq-1' },
        data: { status: 'cancelled' },
      });
      expect(mockExecuteOrQueue).not.toHaveBeenCalled();
    });

    it('cancels sequence for unknown sequence name', async () => {
      mockEmailSeqFindMany.mockResolvedValue([
        { ...ACTIVE_SEQUENCE, sequence: 'nonexistent_sequence' },
      ]);

      await runLifecycleEmail();

      expect(mockEmailSeqUpdate).toHaveBeenCalledWith({
        where: { id: 'seq-1' },
        data: { status: 'cancelled' },
      });
    });

    it('marks sequence completed when all steps are exhausted', async () => {
      // welcome has 3 steps (indices 0-2). currentStep=3 means no step found.
      mockEmailSeqFindMany.mockResolvedValue([{ ...ACTIVE_SEQUENCE, currentStep: 3 }]);

      await runLifecycleEmail();

      expect(mockEmailSeqUpdate).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'seq-1' },
          data: expect.objectContaining({
            status: 'completed',
            completedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('cancels sequence when user is not found', async () => {
      mockEmailSeqFindMany.mockResolvedValue([ACTIVE_SEQUENCE]);
      mockUserFindUnique.mockResolvedValue(null);

      await runLifecycleEmail();

      expect(mockEmailSeqUpdate).toHaveBeenCalledWith({
        where: { id: 'seq-1' },
        data: { status: 'cancelled' },
      });
    });

    it('calls executeOrQueue with correct args for a valid due sequence', async () => {
      mockEmailSeqFindMany.mockResolvedValue([ACTIVE_SEQUENCE]);

      await runLifecycleEmail();

      expect(mockExecuteOrQueue).toHaveBeenCalledWith(
        'lifecycle-email',
        'send_email',
        'medium',
        expect.objectContaining({ userId: 'user-1', sequence: 'welcome', step: 0 }),
        expect.any(Function),
        expect.any(String),
      );
    });
  });

  describe('triggerNewSequences', () => {
    it('creates welcome sequence for a newly registered user', async () => {
      mockUserFindMany.mockResolvedValueOnce([{ id: 'user-new', email: 'new@example.com' }]);

      await runLifecycleEmail();

      expect(mockEmailSeqCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user-new', sequence: 'welcome' }),
        }),
      );
    });

    it('does not create duplicate welcome sequence', async () => {
      mockUserFindMany.mockResolvedValueOnce([{ id: 'user-existing', email: 'old@example.com' }]);
      mockEmailSeqFindUnique.mockResolvedValue({ id: 'seq-existing', sequence: 'welcome' });

      await runLifecycleEmail();

      expect(mockEmailSeqCreate).not.toHaveBeenCalled();
    });

    it('creates onboarding sequence for user with their first outfit check', async () => {
      mockOutfitFindMany.mockResolvedValueOnce([
        { userId: 'u1', createdAt: new Date() },
      ]);

      await runLifecycleEmail();

      expect(mockEmailSeqCreate).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'u1', sequence: 'onboarding' }),
        }),
      );
    });
  });

  it('publishes email_metrics to the intelligence bus on every run', async () => {
    await runLifecycleEmail();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'lifecycle-email',
      'email_metrics',
      expect.objectContaining({ measuredAt: expect.any(String) }),
    );
  });

  it('resolves without throwing when triggerNewSequences DB calls fail', async () => {
    // triggerNewSequences wraps each sub-section in try/catch, so DB errors there are swallowed.
    // processDueSequences.findMany returns [] (default) so it exits early — no unhandled throw.
    mockUserFindMany.mockRejectedValue(new Error('DB error'));
    mockOutfitFindMany.mockRejectedValue(new Error('DB error'));

    await expect(runLifecycleEmail()).resolves.toBeUndefined();
  });
});

// ─── triggerUpgradeSequence ───────────────────────────────────────────────────

describe('triggerUpgradeSequence', () => {
  it('creates upgrade sequence if none exists', async () => {
    mockEmailSeqFindUnique.mockResolvedValue(null);

    await triggerUpgradeSequence('user-abc');

    expect(mockEmailSeqCreate).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-abc',
          sequence: 'upgrade',
          status: 'active',
        }),
      }),
    );
  });

  it('does not create duplicate upgrade sequence', async () => {
    mockEmailSeqFindUnique.mockResolvedValue({ id: 'seq-existing' });

    await triggerUpgradeSequence('user-abc');

    expect(mockEmailSeqCreate).not.toHaveBeenCalled();
  });
});
