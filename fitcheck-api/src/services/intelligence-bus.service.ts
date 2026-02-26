/**
 * Intelligence Bus
 *
 * Persistent cross-agent message board. Agents publish findings;
 * other agents consume them. Entries auto-expire after 14 days.
 */

import { prisma } from '../utils/prisma.js';

export type BusEntryType =
  | 'trend_signal'
  | 'quality_alert'
  | 'critique_finding'
  | 'arena_result'
  | 'discovered_knowledge'
  | 'section_surgery'
  | 'piggyback_scores'
  | 'mutation_result'
  | 'meta_insight'
  | 'budget_skip'
  | 'token_usage'
  | 'calibration_drift'
  // Ops Learning Loop entry types
  | 'email_metrics'
  | 'nudge_metrics'
  | 'social_metrics'
  | 'conversion_metrics'
  | 'ops_critique'
  | 'ops_improvement'
  // RSI Learning System entry types
  | 'followup_metrics'
  | 'milestone_metrics'
  | 'brand_guard_metrics'
  | 'followup_gaps';

/** Publish an entry to the bus */
export async function publishToIntelligenceBus(
  agent: string,
  type: BusEntryType,
  payload: Record<string, unknown>
): Promise<string> {
  const expiresAt = new Date(Date.now() + 14 * 24 * 60 * 60 * 1000);

  const entry = await prisma.intelligenceBusEntry.create({
    data: { agent, entryType: type, payload: payload as any, expiresAt },
  });

  return entry.id;
}

/** Read entries from the bus, optionally marking as consumed */
export async function readFromIntelligenceBus(
  consumer: string,
  type: BusEntryType,
  opts: {
    limit?: number;
    unreadOnly?: boolean;
    sinceDate?: Date;
  } = {}
): Promise<Array<{ id: string; agent: string; payload: Record<string, unknown>; createdAt: Date }>> {
  const where: any = {
    entryType: type,
    expiresAt: { gt: new Date() },
  };

  if (opts.unreadOnly) {
    where.consumedBy = { not: { has: consumer } };
  }

  if (opts.sinceDate) {
    where.createdAt = { gte: opts.sinceDate };
  }

  const entries = await prisma.intelligenceBusEntry.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: opts.limit || 50,
  });

  // Mark as consumed
  if (opts.unreadOnly && entries.length > 0) {
    await Promise.all(
      entries.map(e =>
        prisma.intelligenceBusEntry.update({
          where: { id: e.id },
          data: { consumedBy: { push: consumer } },
        })
      )
    );
  }

  return entries.map(e => ({
    id: e.id,
    agent: e.agent,
    payload: e.payload as Record<string, unknown>,
    createdAt: e.createdAt,
  }));
}

/** Purge expired entries (called daily) */
export async function purgeExpiredBusEntries(): Promise<number> {
  const result = await prisma.intelligenceBusEntry.deleteMany({
    where: { expiresAt: { lt: new Date() } },
  });
  return result.count;
}

/** Read latest entry of a type (convenience helper) */
export async function getLatestBusEntry(
  type: BusEntryType
): Promise<{ payload: Record<string, unknown>; createdAt: Date } | null> {
  const entry = await prisma.intelligenceBusEntry.findFirst({
    where: { entryType: type, expiresAt: { gt: new Date() } },
    orderBy: { createdAt: 'desc' },
  });

  if (!entry) return null;
  return { payload: entry.payload as Record<string, unknown>, createdAt: entry.createdAt };
}
