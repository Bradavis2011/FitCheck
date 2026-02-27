/**
 * Token Budget Manager
 *
 * Manages daily Gemini free-tier token budget (~500K/day).
 * Reserves 25% minimum for real users, allocates remainder to learning system
 * with priority-based gating. Wraps all learning Gemini calls with tracking.
 */

import { GenerativeModel } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';

const DAILY_BUDGET = parseInt(process.env.DAILY_TOKEN_BUDGET || '500000');
// USER_RESERVATION_PCT is documented for reference but currently not used in calculations
// const USER_RESERVATION_PCT = 0.25;
const LEARNING_BUDGET_PCT = parseFloat(process.env.LEARNING_BUDGET_PCT || '0.75');
const LEARNING_FLOOR = parseInt(process.env.LEARNING_BUDGET_FLOOR || '50000');
const HARD_CAP_MULTIPLIER = 1.05;

// Priority thresholds (learning budget needed to run each priority)
export const PRIORITY_THRESHOLDS = {
  1: 0,        // Always runs
  2: 100_000,
  3: 180_000,
  4: 250_000,
  5: 350_000,
  6: 0,        // Fill remaining
} as const;

// ─── Daily record management ──────────────────────────────────────────────────

function getTodayString(): string {
  return new Date().toISOString().split('T')[0];
}

async function getOrCreateTodayRecord() {
  const date = getTodayString();

  // Try to find existing record
  let record = await prisma.dailyTokenUsage.findUnique({ where: { date } });

  if (!record) {
    // Estimate today's user usage from last 7 days average
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

    const recentRecords = await prisma.dailyTokenUsage.findMany({
      where: { date: { gte: sevenDaysAgo.toISOString().split('T')[0] } },
      orderBy: { date: 'desc' },
      take: 7,
    });

    const avgUserTokens = recentRecords.length > 0
      ? recentRecords.reduce((sum, r) => sum + r.userTokens, 0) / recentRecords.length
      : 100_000; // Default estimate

    const learningBudget = Math.max(
      Math.floor(DAILY_BUDGET * LEARNING_BUDGET_PCT - avgUserTokens),
      LEARNING_FLOOR
    );

    record = await prisma.dailyTokenUsage.create({
      data: {
        date,
        budget: DAILY_BUDGET,
        learningBudget,
      },
    });
  }

  return record;
}

// ─── Budget checks ────────────────────────────────────────────────────────────

/** Check if learning system can run at a given priority level */
export async function hasLearningBudget(priority: 1 | 2 | 3 | 4 | 5 | 6): Promise<boolean> {
  if (process.env.ENABLE_LEARNING_SYSTEM === 'false') return false;

  try {
    const record = await getOrCreateTodayRecord();
    const threshold = PRIORITY_THRESHOLDS[priority] || 0;
    return record.learningBudget >= threshold;
  } catch {
    return priority === 1; // Fail-safe: always allow P1
  }
}

/** Reserve tokens atomically. Returns false if budget would be exceeded. */
export async function reserveTokens(
  estimatedTokens: number,
  _category: string,
  isUserCall = false
): Promise<boolean> {
  const date = getTodayString();

  try {
    const record = await getOrCreateTodayRecord();

    const totalUsed = record.userTokens + record.learningTokens + record.reservedTokens;
    const hardCap = record.budget * HARD_CAP_MULTIPLIER;

    if (!isUserCall && totalUsed + estimatedTokens > hardCap) {
      return false;
    }

    // Update reservation
    if (isUserCall) {
      await prisma.dailyTokenUsage.update({
        where: { date },
        data: { reservedTokens: { increment: estimatedTokens } },
      });
    } else {
      await prisma.dailyTokenUsage.update({
        where: { date },
        data: { reservedTokens: { increment: estimatedTokens } },
      });
    }
    return true;
  } catch (err) {
    console.error('[TokenBudget] reserveTokens failed:', err);
    return isUserCall; // Always allow user calls even on error
  }
}

/** Record actual token usage after a Gemini call completes */
export async function recordTokenUsage(
  reservedEstimate: number,
  actualTokens: number,
  category: string,
  isUserCall = false
): Promise<void> {
  const date = getTodayString();

  try {
    const field = isUserCall ? 'userTokens' : 'learningTokens';

    // Get current breakdown
    const record = await prisma.dailyTokenUsage.findUnique({ where: { date } });
    const breakdown = (record?.breakdown as Record<string, number>) || {};
    breakdown[category] = (breakdown[category] || 0) + actualTokens;

    await prisma.dailyTokenUsage.update({
      where: { date },
      data: {
        [field]: { increment: actualTokens },
        reservedTokens: { decrement: reservedEstimate },
        breakdown: breakdown as any,
      },
    });
  } catch (err) {
    console.error('[TokenBudget] recordTokenUsage failed:', err);
  }
}

/** Tracked Gemini call wrapper for learning system */
export async function trackedGenerateContent(
  model: GenerativeModel,
  prompt: string,
  estimatedTokens: number,
  category: string
): Promise<{ text: string; inputTokens: number; outputTokens: number } | null> {
  const canRun = await reserveTokens(estimatedTokens, category);
  if (!canRun) {
    console.log(`[TokenBudget] Blocked ${category} — budget exhausted`);
    return null;
  }

  try {
    const result = await model.generateContent(prompt);
    const text = result.response.text();

    const usageMeta = result.response.usageMetadata;
    const inputTokens = usageMeta?.promptTokenCount || Math.floor(estimatedTokens * 0.6);
    const outputTokens = usageMeta?.candidatesTokenCount || Math.floor(estimatedTokens * 0.4);
    const actualTotal = inputTokens + outputTokens;

    await recordTokenUsage(estimatedTokens, actualTotal, category);

    return { text, inputTokens, outputTokens };
  } catch (err) {
    await recordTokenUsage(estimatedTokens, 0, category);
    throw err;
  }
}

/** Record user token usage (called from ai-feedback.service.ts) */
export async function recordUserTokens(
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  const actual = inputTokens + outputTokens;
  await recordTokenUsage(0, actual, 'outfit_analysis', true);
}

/** Get today's usage summary */
export async function getTodayUsage() {
  return getOrCreateTodayRecord();
}

/** Reset daily budget (called at midnight UTC by scheduler) */
export async function resetDailyBudget(): Promise<void> {
  // Just ensure today's record is created fresh (getOrCreateTodayRecord handles this)
  await getOrCreateTodayRecord();
  console.log('[TokenBudget] Daily budget reset for', getTodayString());
}
