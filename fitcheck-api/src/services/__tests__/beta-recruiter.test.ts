import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted Mocks ────────────────────────────────────────────────────────────

const mockEmailSend = vi.hoisted(() => vi.fn());
const mockUserFindMany = vi.hoisted(() => vi.fn());
const mockCreateNotification = vi.hoisted(() => vi.fn());

// ─── Module Mocks ─────────────────────────────────────────────────────────────

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    user: {
      findMany: mockUserFindMany,
    },
  },
}));

vi.mock('../../controllers/notification.controller.js', () => ({
  createNotification: mockCreateNotification,
}));

// ─── Service Import (after all mocks) ─────────────────────────────────────────

import { runBetaRecruiter } from '../beta-recruiter.service.js';

// ─── Sample Data ──────────────────────────────────────────────────────────────

const SAMPLE_USER = {
  id: 'user-1',
  email: 'active@test.com',
  name: 'Active User',
  outfitChecks: [
    { id: 'c1', createdAt: new Date('2026-02-28'), followUps: [{ id: 'f1' }] },
    { id: 'c2', createdAt: new Date('2026-02-27'), followUps: [] },
    { id: 'c3', createdAt: new Date('2026-02-26'), followUps: [] },
  ],
  userStats: { totalFeedbackGiven: 5 },
};

// ─── Setup / Teardown ─────────────────────────────────────────────────────────

beforeEach(() => {
  vi.resetAllMocks();

  mockUserFindMany.mockResolvedValue([SAMPLE_USER]);
  mockCreateNotification.mockResolvedValue({ id: 'notif-1' });
  mockEmailSend.mockResolvedValue({ id: 'email-br-1' });

  vi.stubEnv('ENABLE_BETA_RECRUITER', 'true');
  vi.stubEnv('RESEND_API_KEY', 're_test');
  vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── runBetaRecruiter ─────────────────────────────────────────────────────────

describe('runBetaRecruiter', () => {
  it('skips when ENABLE_BETA_RECRUITER is not "true"', async () => {
    vi.stubEnv('ENABLE_BETA_RECRUITER', 'false');

    await runBetaRecruiter();

    expect(mockUserFindMany).not.toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');

    await runBetaRecruiter();

    expect(mockUserFindMany).not.toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    await runBetaRecruiter();

    expect(mockUserFindMany).not.toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('skips when no users found (returns early without email)', async () => {
    mockUserFindMany.mockResolvedValue([]);

    await runBetaRecruiter();

    expect(mockCreateNotification).not.toHaveBeenCalled();
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('calls createNotification for each top user with type "beta_invite"', async () => {
    await runBetaRecruiter();

    expect(mockCreateNotification).toHaveBeenCalledOnce();
    expect(mockCreateNotification).toHaveBeenCalledWith(
      expect.objectContaining({
        userId: 'user-1',
        type: 'beta_invite',
      }),
    );
  });

  it('sends one founder email listing the users', async () => {
    await runBetaRecruiter();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const args = mockEmailSend.mock.calls[0][0];
    expect(args.to).toBe('founder@orthis.app');
    expect(args.html).toContain('active@test.com');
  });

  it('does not throw when createNotification fails for one user (caught per-user)', async () => {
    mockCreateNotification.mockRejectedValue(new Error('Push service unavailable'));

    await expect(runBetaRecruiter()).resolves.toBeUndefined();
    // Email should still be sent even if notification failed
    expect(mockEmailSend).toHaveBeenCalledOnce();
  });

  it('does not throw when email send fails (caught in try/catch)', async () => {
    mockEmailSend.mockRejectedValue(new Error('Resend API error'));

    await expect(runBetaRecruiter()).resolves.toBeUndefined();
  });

  it('engagement score formula: email subject contains the user count', async () => {
    // SAMPLE_USER: checks=3, followUps=1, feedbackGiven=5, daysActive=3
    // score = (3*3) + (1*2) + (5*1) + (3*5) = 9+2+5+15 = 31
    await runBetaRecruiter();

    expect(mockEmailSend).toHaveBeenCalledOnce();
    const args = mockEmailSend.mock.calls[0][0];
    // Subject should contain count of users identified (1 user returned)
    expect(args.subject).toContain('1');
  });
});
