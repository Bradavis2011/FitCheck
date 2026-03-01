/**
 * Infrastructure Monitor Service
 *
 * Monitors server health: memory usage, failed agent actions, and other
 * infrastructure signals. Publishes metrics to the Intelligence Bus so
 * the founder brief and ops agents have visibility into platform health.
 */

import { prisma } from '../utils/prisma.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

// ─── Core Monitor ─────────────────────────────────────────────────────────────

export async function runInfraMonitor(): Promise<void> {
  console.log('[InfraMonitor] Running infrastructure health check...');

  // ── Memory check ──
  const mem = process.memoryUsage();
  const heapUsedMB = Math.round(mem.heapUsed / 1024 / 1024);
  const heapTotalMB = Math.round(mem.heapTotal / 1024 / 1024);
  const heapUsedPct = parseFloat((mem.heapUsed / mem.heapTotal).toFixed(4));

  if (heapUsedPct > 0.85) {
    console.warn(
      `[InfraMonitor] HIGH MEMORY: heap ${heapUsedMB}MB / ${heapTotalMB}MB (${(heapUsedPct * 100).toFixed(1)}%)`
    );
  } else {
    console.log(
      `[InfraMonitor] Memory OK: heap ${heapUsedMB}MB / ${heapTotalMB}MB (${(heapUsedPct * 100).toFixed(1)}%)`
    );
  }

  // Prisma middleware for slow queries can be added in prisma.ts

  // ── High error rate check (failed AgentActions in last hour) ──
  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
  let failedActionsLastHour = 0;

  try {
    failedActionsLastHour = await prisma.agentAction.count({
      where: {
        status: 'failed',
        createdAt: { gte: oneHourAgo },
      },
    });

    if (failedActionsLastHour > 10) {
      console.warn(
        `[InfraMonitor] HIGH ERROR RATE: ${failedActionsLastHour} failed agent actions in the last hour`
      );
    } else {
      console.log(`[InfraMonitor] Agent error rate OK: ${failedActionsLastHour} failures in last hour`);
    }
  } catch (err) {
    console.error('[InfraMonitor] Failed to query agent action count:', err);
  }

  // ── Publish to Intelligence Bus ──
  try {
    await publishToIntelligenceBus('infra-monitor', 'infra_metrics', {
      heapUsedMB,
      heapTotalMB,
      heapUsedPct,
      failedActionsLastHour,
      timestamp: new Date().toISOString(),
    });
    console.log('[InfraMonitor] Published infra_metrics to bus');
  } catch (err) {
    console.error('[InfraMonitor] Failed to publish to bus:', err);
  }
}

// ─── Summary for Founder Brief ────────────────────────────────────────────────

export async function getInfraSummary(): Promise<{ heapUsedPct: number; failedActionsLastHour: number }> {
  const mem = process.memoryUsage();
  const heapUsedPct = parseFloat((mem.heapUsed / mem.heapTotal).toFixed(4));

  const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);

  let failedActionsLastHour = 0;
  try {
    failedActionsLastHour = await prisma.agentAction.count({
      where: {
        status: 'failed',
        createdAt: { gte: oneHourAgo },
      },
    });
  } catch {
    // Non-fatal — return 0 on DB error
  }

  return { heapUsedPct, failedActionsLastHour };
}
