/**
 * Uptime Monitor Service
 *
 * Hits the app's own /health endpoint on a schedule.
 * Sends an emergency email if 3 consecutive failures are detected.
 * Publishes daily uptime metrics to the Intelligence Bus.
 */

import { Resend } from 'resend';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

let consecutiveFailures = 0;
let dailyFailureCount = 0;

let _resend: Resend | null = null;

function getResend(): Resend | null {
  if (_resend) return _resend;
  const key = process.env.RESEND_API_KEY;
  if (!key) return null;
  _resend = new Resend(key);
  return _resend;
}

function getHealthUrl(): string {
  const base =
    process.env.API_BASE_URL ||
    `http://localhost:${process.env.PORT || '3000'}`;
  return `${base}/health`;
}

async function sendDownAlert(failureCount: number): Promise<void> {
  const resend = getResend();
  const recipient = process.env.REPORT_RECIPIENT_EMAIL;
  if (!resend || !recipient) {
    console.error('[UptimeMonitor] Cannot send alert — Resend or recipient not configured');
    return;
  }

  const now = new Date().toISOString();
  await resend.emails.send({
    from: 'Or This? Alerts <alerts@orthis.app>',
    to: recipient,
    subject: '[URGENT] Or This? API is DOWN',
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;">
        <h2 style="color:#EF4444;">API Down Alert</h2>
        <p>The Or This? API health endpoint has failed <strong>${failureCount} consecutive checks</strong>.</p>
        <p><strong>Time:</strong> ${now}</p>
        <p><strong>Endpoint:</strong> ${getHealthUrl()}</p>
        <p>Please check Railway logs and restart the service if necessary.</p>
      </div>
    `,
  });

  console.log(`[UptimeMonitor] Emergency alert sent after ${failureCount} consecutive failures`);
}

// ─── Core Check ───────────────────────────────────────────────────────────────

export async function runUptimeCheck(): Promise<void> {
  const url = getHealthUrl();

  try {
    const res = await fetch(url, {
      signal: AbortSignal.timeout(5000),
    });

    if (res.ok) {
      consecutiveFailures = 0;
    } else {
      throw new Error(`HTTP ${res.status}`);
    }
  } catch (err: any) {
    consecutiveFailures++;
    dailyFailureCount++;
    console.warn(
      `[UptimeMonitor] Health check failed (consecutive: ${consecutiveFailures}): ${err?.message}`
    );

    if (consecutiveFailures >= 3) {
      try {
        await sendDownAlert(consecutiveFailures);
      } catch (alertErr) {
        console.error('[UptimeMonitor] Failed to send down alert:', alertErr);
      }
      // Reset to avoid alert spam; will re-alert after 3 more failures
      consecutiveFailures = 0;
    }
  }
}

// ─── Daily Metrics ────────────────────────────────────────────────────────────

export async function trackDailyUptime(): Promise<void> {
  const date = new Date().toISOString().slice(0, 10);
  // Assume checks run every 5 minutes → ~288 checks/day
  const totalChecks = 288;
  const uptimePct =
    totalChecks > 0
      ? Math.max(0, ((totalChecks - dailyFailureCount) / totalChecks) * 100)
      : 100;

  try {
    await publishToIntelligenceBus('uptime-monitor', 'uptime_metrics', {
      date,
      failureCount: dailyFailureCount,
      uptimePct: parseFloat(uptimePct.toFixed(2)),
    });
  } catch (err) {
    console.error('[UptimeMonitor] Failed to publish uptime metrics:', err);
  }

  // Reset daily counter after publishing
  dailyFailureCount = 0;
}

// ─── Summary for Founder Brief ────────────────────────────────────────────────

export async function getUptimeSummary(): Promise<{ failureCount: number }> {
  return { failureCount: dailyFailureCount };
}
