/**
 * E2E Test Service
 *
 * Runs automated smoke checks against the app's own API endpoints.
 * Only tests non-authenticated endpoints so no test user is needed.
 * Publishes results to the Intelligence Bus and emails the founder
 * if any check fails.
 *
 * Designed to run on a schedule (e.g. every 30 minutes or daily).
 */

import { publishToIntelligenceBus, getLatestBusEntry } from './intelligence-bus.service.js';
import { Resend } from 'resend';

// ─── Types ────────────────────────────────────────────────────────────────────

interface TestCase {
  label: string;
  endpoint: string;
  method: string;
  body?: Record<string, unknown>;
  expectedStatuses: number[];
}

interface TestFailure {
  endpoint: string;
  expected: number[];
  got: number | string;
}

interface E2eMetrics {
  total: number;
  passed: number;
  failed: number;
  failures: TestFailure[];
  ranAt: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getBaseUrl(): string {
  return (
    process.env.API_BASE_URL ||
    `http://localhost:${process.env.PORT || '3000'}`
  );
}

// ─── Test Cases ───────────────────────────────────────────────────────────────

function buildTestCases(): TestCase[] {
  return [
    {
      label: 'GET /health → 200',
      endpoint: '/health',
      method: 'GET',
      expectedStatuses: [200],
    },
    {
      label: 'POST /api/auth/signin with bad credentials → 400 or 401 (not 500)',
      endpoint: '/api/auth/signin',
      method: 'POST',
      body: { email: 'invalid@test.invalid', password: 'wrongpassword123' },
      expectedStatuses: [400, 401, 422],
    },
    {
      label: 'GET /api/outfits (no auth) → 401',
      endpoint: '/api/outfits',
      method: 'GET',
      expectedStatuses: [401],
    },
  ];
}

// ─── Core Runner ──────────────────────────────────────────────────────────────

export async function runE2eTests(): Promise<void> {
  console.log('[E2eTest] Running automated endpoint smoke tests...');

  const base = getBaseUrl();
  const testCases = buildTestCases();
  const failures: TestFailure[] = [];
  let passed = 0;

  for (const tc of testCases) {
    const url = `${base}${tc.endpoint}`;
    let gotStatus: number | string = 'network_error';

    try {
      const init: RequestInit = {
        method: tc.method,
        signal: AbortSignal.timeout(8000),
      };

      if (tc.body) {
        init.headers = { 'Content-Type': 'application/json' };
        init.body = JSON.stringify(tc.body);
      }

      const res = await fetch(url, init);
      gotStatus = res.status;
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      gotStatus = `network_error: ${msg}`;
      console.warn(`[E2eTest] ${tc.label} — network error: ${msg}`);
    }

    const statusNum = typeof gotStatus === 'number' ? gotStatus : -1;
    const isPass =
      typeof gotStatus === 'number' && tc.expectedStatuses.includes(statusNum);

    if (isPass) {
      passed++;
      console.log(`[E2eTest] PASS: ${tc.label} (got ${gotStatus})`);
    } else {
      console.warn(
        `[E2eTest] FAIL: ${tc.label} — expected ${tc.expectedStatuses.join(' or ')}, got ${gotStatus}`
      );
      failures.push({
        endpoint: `${tc.method} ${tc.endpoint}`,
        expected: tc.expectedStatuses,
        got: gotStatus,
      });
    }
  }

  const total = testCases.length;
  const failed = failures.length;

  const metrics: E2eMetrics = {
    total,
    passed,
    failed,
    failures,
    ranAt: new Date().toISOString(),
  };

  // ── Publish to bus ──
  try {
    await publishToIntelligenceBus(
      'e2e-test',
      'e2e_metrics',
      metrics as unknown as Record<string, unknown>
    );
    console.log(`[E2eTest] Published e2e_metrics: ${passed}/${total} passed`);
  } catch (err) {
    console.error('[E2eTest] Failed to publish to bus:', err);
  }

  // ── Alert founder on failure ──
  if (failed > 0) {
    const resend = process.env.RESEND_API_KEY ? new Resend(process.env.RESEND_API_KEY) : null;
    const recipient = process.env.REPORT_RECIPIENT_EMAIL;

    if (resend && recipient) {
      const failureRows = failures
        .map(
          f =>
            `<tr>
              <td style="padding:8px 12px;font-size:13px;font-family:monospace;">${f.endpoint}</td>
              <td style="padding:8px 12px;font-size:13px;color:#6B7280;">${f.expected.join(' | ')}</td>
              <td style="padding:8px 12px;font-size:13px;color:#EF4444;font-weight:600;">${f.got}</td>
            </tr>`
        )
        .join('');

      const html = `<!DOCTYPE html><html><body style="font-family:Arial,sans-serif;background:#FBF7F4;padding:40px;">
  <div style="max-width:620px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.08);">
    <div style="background:#EF4444;padding:28px 40px;text-align:center;">
      <div style="font-size:22px;font-weight:700;color:#fff;">E2E Test Failures</div>
      <div style="font-size:13px;color:rgba(255,255,255,0.85);margin-top:4px;">${failed} of ${total} checks failed · ${new Date().toISOString()}</div>
    </div>
    <div style="padding:32px 40px;">
      <p style="font-size:14px;color:#1A1A1A;margin-bottom:24px;">
        The Or This? API failed <strong>${failed}</strong> automated smoke test${failed !== 1 ? 's' : ''}. Please investigate.
      </p>
      <table width="100%" style="border-collapse:collapse;">
        <thead>
          <tr style="background:#F5EDE7;">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;">Endpoint</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;">Expected</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6B7280;">Got</th>
          </tr>
        </thead>
        <tbody>${failureRows}</tbody>
      </table>
      <p style="font-size:13px;color:#6B7280;margin-top:20px;">Base URL: <code>${base}</code></p>
    </div>
    <div style="background:#F5EDE7;padding:16px 40px;text-align:center;">
      <p style="color:#6B7280;font-size:12px;margin:0;">Or This? · E2E Test Agent · ${new Date().toISOString()}</p>
    </div>
  </div>
</body></html>`;

      try {
        await resend.emails.send({
          from: process.env.REPORT_FROM_EMAIL || 'alerts@orthis.app',
          to: recipient,
          subject: `[Or This?] E2E Test Alert — ${failed} endpoint check${failed !== 1 ? 's' : ''} failed`,
          html,
        });
        console.log('[E2eTest] Failure alert email sent to founder');
      } catch (emailErr) {
        console.error('[E2eTest] Failed to send alert email:', emailErr);
      }
    }
  }

  console.log(`[E2eTest] Done — ${passed}/${total} passed, ${failed} failed`);
}

// ─── Summary for Founder Brief ────────────────────────────────────────────────

export async function getE2eSummary(): Promise<{ lastRunPassed: boolean; failureCount: number }> {
  try {
    const entry = await getLatestBusEntry('e2e_metrics');

    if (!entry) {
      // No run recorded yet — treat as unknown/passing
      return { lastRunPassed: true, failureCount: 0 };
    }

    const payload = entry.payload as unknown as E2eMetrics;
    const failureCount = payload.failed ?? 0;

    return {
      lastRunPassed: failureCount === 0,
      failureCount,
    };
  } catch (err) {
    console.error('[E2eTest] getE2eSummary failed:', err);
    return { lastRunPassed: true, failureCount: 0 };
  }
}
