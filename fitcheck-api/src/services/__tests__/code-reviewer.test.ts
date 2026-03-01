import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

// ─── Hoisted mocks ────────────────────────────────────────────────────────────

const mockReaddirSync = vi.hoisted(() => vi.fn());
const mockReadFileSync = vi.hoisted(() => vi.fn());
const mockExecSync = vi.hoisted(() => vi.fn());
const mockPublishBus = vi.hoisted(() => vi.fn());
const mockEmailSend = vi.hoisted(() => vi.fn());
const mockBusFindFirst = vi.hoisted(() => vi.fn());

vi.mock('fs', () => ({
  readdirSync: mockReaddirSync,
  readFileSync: mockReadFileSync,
}));

vi.mock('child_process', () => ({
  execSync: mockExecSync,
}));

vi.mock('resend', () => ({
  Resend: class {
    emails = { send: mockEmailSend };
  },
}));

vi.mock('../intelligence-bus.service.js', () => ({
  publishToIntelligenceBus: mockPublishBus,
}));

vi.mock('../../utils/prisma.js', () => ({
  prisma: {
    intelligenceBusEntry: { findFirst: mockBusFindFirst },
  },
}));

import { runCodeReview, getCodeReviewSummary } from '../code-reviewer.service.js';

// ─── Setup ────────────────────────────────────────────────────────────────────

beforeEach(() => {
  mockReaddirSync.mockReset();
  mockReadFileSync.mockReset();
  mockExecSync.mockReset();
  mockPublishBus.mockReset();
  mockEmailSend.mockReset();
  mockBusFindFirst.mockReset();

  // Default: empty directory so walkTs() returns no files
  mockReaddirSync.mockReturnValue([]);

  // Default: execSync throws (simulate both tsc and prisma failing) —
  // throw with no stdout/stderr → errorCount === 0 → no TS finding;
  // prisma also throws → high finding on prisma check
  // We override per-test where needed.
  mockExecSync.mockImplementation(() => {
    const err: any = new Error('command failed');
    err.stdout = '';
    err.stderr = '';
    throw err;
  });

  // Default: readFileSync returns empty string
  mockReadFileSync.mockReturnValue('');

  mockPublishBus.mockResolvedValue(undefined);
  mockEmailSend.mockResolvedValue({ id: 'email-1' });
  mockBusFindFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runCodeReview', () => {
  it('always sends email even with 0 findings when credentials are set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    // Both tsc and prisma succeed → 0 findings
    mockExecSync.mockReturnValue('');

    await runCodeReview();

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });

  it('does not send email when RESEND_API_KEY is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    mockExecSync.mockReturnValue('');

    await runCodeReview();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('does not send email when REPORT_RECIPIENT_EMAIL is not set', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', '');

    mockExecSync.mockReturnValue('');

    await runCodeReview();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('produces a high finding when tsc throws with TS error lines', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('tsc')) {
        const err: any = new Error('tsc failed');
        err.stdout = 'src/foo.ts(10,5): error TS2345: Argument of type string is not assignable\n';
        err.stderr = '';
        throw err;
      }
      // prisma validate succeeds
      return '';
    });

    await runCodeReview();

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toMatch(/finding/i);
  });

  it('produces no TS finding when tsc succeeds', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    // Both succeed → 0 findings
    mockExecSync.mockReturnValue('');

    await runCodeReview();

    // Email still sent (always), but subject says "All clear"
    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toContain('All clear');
  });

  it('produces a high finding when prisma validate throws', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    mockExecSync.mockImplementation((cmd: string) => {
      if (cmd.includes('tsc')) return ''; // tsc ok
      // prisma validate fails
      const err: any = new Error('prisma validate failed');
      err.stderr = 'Schema validation error: field X is required';
      err.stdout = '';
      throw err;
    });

    await runCodeReview();

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toMatch(/finding/i);
  });

  it('produces no prisma finding when prisma validate succeeds', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    mockExecSync.mockReturnValue(''); // both tsc and prisma succeed

    await runCodeReview();

    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toContain('All clear');
  });

  it('always calls publishToIntelligenceBus regardless of findings', async () => {
    mockExecSync.mockReturnValue('');

    await runCodeReview();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'code-reviewer',
      'code_review',
      expect.objectContaining({
        total: expect.any(Number),
        high: expect.any(Number),
        reviewedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it('rejects when email send throws (no swallowing in the service)', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    mockExecSync.mockReturnValue('');
    mockEmailSend.mockRejectedValue(new Error('Resend unavailable'));

    await expect(runCodeReview()).rejects.toThrow('Resend unavailable');
  });
});

describe('getCodeReviewSummary', () => {
  it('returns null when no intelligence bus entry exists', async () => {
    mockBusFindFirst.mockResolvedValue(null);

    const result = await getCodeReviewSummary();

    expect(result).toBeNull();
  });

  it('returns total and high counts from the latest bus entry', async () => {
    mockBusFindFirst.mockResolvedValue({
      payload: { total: 4, high: 2, medium: 1, low: 1 },
    });

    const result = await getCodeReviewSummary();

    expect(result).toEqual({ total: 4, high: 2 });
  });

  it('returns null when the prisma query throws', async () => {
    mockBusFindFirst.mockRejectedValue(new Error('DB error'));

    const result = await getCodeReviewSummary();

    expect(result).toBeNull();
  });
});
