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

import { runSecurityAudit, getSecurityAuditSummary } from '../security-auditor.service.js';

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

  // Default: execSync throws (npm audit exits non-zero with no output → no findings)
  mockExecSync.mockImplementation(() => {
    const err: any = new Error('npm audit exit 1');
    err.stdout = '{}';
    throw err;
  });

  // Default: readFileSync returns empty string (no stack leak, no dashboard issue)
  mockReadFileSync.mockReturnValue('');

  mockPublishBus.mockResolvedValue(undefined);
  mockEmailSend.mockResolvedValue({ id: 'email-1' });
  mockBusFindFirst.mockResolvedValue(null);
});

afterEach(() => {
  vi.unstubAllEnvs();
});

// ─── Tests ────────────────────────────────────────────────────────────────────

describe('runSecurityAudit', () => {
  it('does not send email when RESEND_API_KEY is not set even with findings', async () => {
    // Trigger a critical finding via CORS_ORIGIN wildcard
    vi.stubEnv('CORS_ORIGIN', '*');
    vi.stubEnv('RESEND_API_KEY', '');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await runSecurityAudit();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('does not send email when all checks pass (no findings)', async () => {
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');
    // CORS_ORIGIN is safe, ADMIN_DASHBOARD_TOKEN is long enough
    vi.stubEnv('CORS_ORIGIN', 'https://orthis.app');
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'a'.repeat(32));

    await runSecurityAudit();

    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('sends email when CORS_ORIGIN includes wildcard (critical finding)', async () => {
    vi.stubEnv('CORS_ORIGIN', '*');
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'a'.repeat(32));
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await runSecurityAudit();

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toContain('critical');
  });

  it('produces no CORS finding when CORS_ORIGIN is a safe domain', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://orthis.app');
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'a'.repeat(32));
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await runSecurityAudit();

    // No findings → email not sent
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('produces high finding when ADMIN_DASHBOARD_TOKEN is shorter than 32 chars', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://orthis.app');
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'short');
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await runSecurityAudit();

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toMatch(/finding/i);
  });

  it('produces high finding when ADMIN_DASHBOARD_TOKEN is missing', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://orthis.app');
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', '');
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await runSecurityAudit();

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
  });

  it('produces no finding when ADMIN_DASHBOARD_TOKEN is 32+ chars', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://orthis.app');
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'a'.repeat(32));
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    await runSecurityAudit();

    // No findings → email not sent
    expect(mockEmailSend).not.toHaveBeenCalled();
  });

  it('reports critical/high vuln when npm audit stdout contains vulnerabilities', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://orthis.app');
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'a'.repeat(32));
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    // npm audit exits non-zero; stdout has the JSON with critical vuln
    mockExecSync.mockImplementation(() => {
      const err: any = new Error('npm audit exit 1');
      err.stdout = JSON.stringify({
        metadata: {
          vulnerabilities: { critical: 2, high: 0, moderate: 0, low: 0 },
        },
      });
      throw err;
    });

    await runSecurityAudit();

    expect(mockEmailSend).toHaveBeenCalledTimes(1);
    const callArgs = mockEmailSend.mock.calls[0][0];
    expect(callArgs.subject).toContain('critical');
  });

  it('always calls publishToIntelligenceBus regardless of findings', async () => {
    vi.stubEnv('CORS_ORIGIN', 'https://orthis.app');
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'a'.repeat(32));

    await runSecurityAudit();

    expect(mockPublishBus).toHaveBeenCalledWith(
      'security-auditor',
      'security_audit',
      expect.objectContaining({
        total: expect.any(Number),
        critical: expect.any(Number),
        high: expect.any(Number),
        checkedAt: expect.stringMatching(/^\d{4}-\d{2}-\d{2}T/),
      }),
    );
  });

  it('rejects when email send throws (no swallowing in the service)', async () => {
    vi.stubEnv('CORS_ORIGIN', '*');
    vi.stubEnv('ADMIN_DASHBOARD_TOKEN', 'a'.repeat(32));
    vi.stubEnv('RESEND_API_KEY', 're_test_key');
    vi.stubEnv('REPORT_RECIPIENT_EMAIL', 'founder@orthis.app');

    mockEmailSend.mockRejectedValue(new Error('Resend unavailable'));

    await expect(runSecurityAudit()).rejects.toThrow('Resend unavailable');
  });
});

describe('getSecurityAuditSummary', () => {
  it('returns null when no intelligence bus entry exists', async () => {
    mockBusFindFirst.mockResolvedValue(null);

    const result = await getSecurityAuditSummary();

    expect(result).toBeNull();
  });

  it('returns total/critical/high counts from the latest bus entry', async () => {
    mockBusFindFirst.mockResolvedValue({
      payload: { total: 5, critical: 2, high: 1, medium: 2, low: 0 },
    });

    const result = await getSecurityAuditSummary();

    expect(result).toEqual({ total: 5, critical: 2, high: 1 });
  });

  it('returns null when the prisma query throws', async () => {
    mockBusFindFirst.mockRejectedValue(new Error('DB error'));

    const result = await getSecurityAuditSummary();

    expect(result).toBeNull();
  });
});
