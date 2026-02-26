/**
 * Prompt Assembly Service
 *
 * Assembles the system prompt from 13 independently versioned PromptSection rows.
 * Falls back to hardcoded SYSTEM_PROMPT if no DB entries exist.
 * Compiles Learning Memory from Intelligence Bus entries and DiscoveredRules.
 */

import { prisma } from '../utils/prisma.js';
import { readFromIntelligenceBus } from './intelligence-bus.service.js';

// Section keys in order (matches the 13 sections of the system prompt)
export const SECTION_KEYS = [
  'voice_persona',
  'voice_examples',
  'color_theory',
  'proportions_silhouette',
  'fit_principles',
  'body_balance',
  'occasion_dress_codes',
  'style_coherence',
  'style_lanes',
  'styling_moves',
  'seasonal_practical',
  'examples',
  'analysis_scoring',
] as const;

export type SectionKey = typeof SECTION_KEYS[number];

// Follow-up prompt sections
export const FOLLOWUP_SECTION_KEYS = [
  'followup_persona',
  'followup_context_rules',
  'followup_response_format',
] as const;

interface AssembledPrompt {
  text: string;
  versionFingerprint: string;
  fromDB: boolean;
  sectionVersions: Record<string, number>;
}

/** Assemble the full system prompt from DB sections (or fallback to hardcoded) */
export async function assemblePrompt(
  includeFollowup = false
): Promise<AssembledPrompt> {
  try {
    const keys = includeFollowup
      ? [...SECTION_KEYS, ...FOLLOWUP_SECTION_KEYS]
      : [...SECTION_KEYS];

    // Fetch active versions of all sections
    const sections = await prisma.promptSection.findMany({
      where: {
        sectionKey: { in: keys as string[] },
        isActive: true,
      },
      orderBy: [{ sectionKey: 'asc' }, { version: 'desc' }],
    });

    if (sections.length === 0) {
      // No DB sections — use hardcoded prompt (will be seeded by seed script)
      return {
        text: '', // Caller will use SYSTEM_PROMPT constant
        versionFingerprint: 'hardcoded',
        fromDB: false,
        sectionVersions: {},
      };
    }

    // Deduplicate: keep highest version per section key
    const latestByKey = new Map<string, typeof sections[0]>();
    for (const s of sections) {
      if (!latestByKey.has(s.sectionKey)) {
        latestByKey.set(s.sectionKey, s);
      }
    }

    // Sort by orderIndex
    const orderedSections = [...latestByKey.values()].sort(
      (a, b) => a.orderIndex - b.orderIndex
    );

    // Build version fingerprint
    const sectionVersions: Record<string, number> = {};
    for (const s of orderedSections) {
      sectionVersions[s.sectionKey] = s.version;
    }
    const fingerprint = Object.entries(sectionVersions)
      .map(([k, v]) => `${k}:${v}`)
      .join('|');

    // Concatenate sections
    let text = orderedSections.map(s => s.content).join('\n\n');

    // A5: Append per-occasion calibration corrections if community data supports them
    const biasCorrections = await getCategoryBiasCorrections();
    if (biasCorrections) text += biasCorrections;

    return { text, versionFingerprint: fingerprint, fromDB: true, sectionVersions };
  } catch (err) {
    console.error('[PromptAssembly] assemblePrompt failed:', err);
    return {
      text: '',
      versionFingerprint: 'fallback',
      fromDB: false,
      sectionVersions: {},
    };
  }
}

/** Get a specific active section */
export async function getSection(sectionKey: string): Promise<{
  id: string;
  version: number;
  content: string;
  failedAttempts: unknown[];
} | null> {
  const section = await prisma.promptSection.findFirst({
    where: { sectionKey, isActive: true },
    orderBy: { version: 'desc' },
  });

  if (!section) return null;

  return {
    id: section.id,
    version: section.version,
    content: section.content,
    failedAttempts: (section.failedAttempts as unknown[]) || [],
  };
}

/** Create a new section version (does NOT activate it yet) */
export async function createSectionVersion(
  sectionKey: string,
  content: string,
  source: 'surgeon-reactive' | 'surgeon-mutation' | 'manual',
  changelog: string,
  parentVersion: number
): Promise<{ id: string; version: number }> {
  // Get next version number
  const latest = await prisma.promptSection.findFirst({
    where: { sectionKey },
    orderBy: { version: 'desc' },
  });

  const nextVersion = (latest?.version || 0) + 1;

  // Get orderIndex from parent
  const orderIndex = latest?.orderIndex || 0;

  const section = await prisma.promptSection.create({
    data: {
      sectionKey,
      version: nextVersion,
      content,
      isActive: false,
      parentVersion,
      source,
      changelog,
      orderIndex,
    },
  });

  return { id: section.id, version: section.version };
}

/** Activate a new section version (deactivates old one) */
export async function activateSectionVersion(
  sectionKey: string,
  version: number,
  arenaWinRate: number
): Promise<void> {
  await prisma.$transaction([
    // Deactivate all existing versions
    prisma.promptSection.updateMany({
      where: { sectionKey, isActive: true },
      data: { isActive: false },
    }),
    // Activate the new one
    prisma.promptSection.updateMany({
      where: { sectionKey, version },
      data: { isActive: true, arenaWinRate },
    }),
  ]);
}

/** Record a failed attempt on the current active section */
export async function recordFailedAttempt(
  sectionKey: string,
  changelog: string,
  failReason: string
): Promise<void> {
  const current = await prisma.promptSection.findFirst({
    where: { sectionKey, isActive: true },
    orderBy: { version: 'desc' },
  });

  if (!current) return;

  const existing = (current.failedAttempts as any[]) || [];
  existing.push({
    changelog,
    failReason,
    attemptedAt: new Date().toISOString(),
  });

  await prisma.promptSection.update({
    where: { id: current.id },
    data: { failedAttempts: existing as any },
  });
}

// ─── Learning Memory ──────────────────────────────────────────────────────────

/**
 * Compile a compact Learning Memory block from accumulated knowledge.
 * Called daily at 2am UTC (before Critic runs).
 * Returns the compiled text block + persists to DB.
 */
export async function distillLearningMemory(): Promise<string> {
  const bullets: string[] = [];

  try {
    // 1. Recent addressed critique findings (improvements that worked)
    const critiqueDays = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);
    const critiqueEntries = await readFromIntelligenceBus(
      'learning-memory',
      'critique_finding',
      { limit: 20, sinceDate: critiqueDays }
    );

    for (const entry of critiqueEntries.slice(0, 3)) {
      const p = entry.payload;
      if (p.summary && typeof p.summary === 'string') {
        bullets.push(p.summary);
      }
    }

    // 2. Successful mutation results
    const mutationEntries = await readFromIntelligenceBus(
      'learning-memory',
      'mutation_result',
      { limit: 10, sinceDate: critiqueDays }
    );

    for (const entry of mutationEntries.slice(0, 3)) {
      const p = entry.payload;
      if (p.insight && typeof p.insight === 'string') {
        bullets.push(p.insight);
      }
    }

    // 3. Recent DiscoveredRules from recursive improvement
    const rules = await prisma.discoveredRule.findMany({
      where: { incorporated: false },
      orderBy: { confidence: 'desc' },
      take: 5,
    });

    for (const rule of rules) {
      if (rule.confidence >= 0.7) {
        bullets.push(rule.rule);
      }
    }

    // 4. Piggyback score insights
    const piggybackEntries = await readFromIntelligenceBus(
      'learning-memory',
      'piggyback_scores',
      { limit: 7, sinceDate: critiqueDays }
    );

    for (const entry of piggybackEntries.slice(0, 2)) {
      const p = entry.payload;
      if (p.topInsight && typeof p.topInsight === 'string') {
        bullets.push(p.topInsight);
      }
    }
  } catch (err) {
    console.error('[LearningMemory] Error reading from bus:', err);
  }

  // Deduplicate and limit to 10 bullets
  const uniqueBullets = [...new Set(bullets)].slice(0, 10);

  if (uniqueBullets.length === 0) {
    return ''; // No knowledge yet
  }

  const compiledText = `LEARNED PATTERNS (from self-improvement system — updated daily):
${uniqueBullets.map(b => `- ${b}`).join('\n')}`;

  // Persist to DB
  try {
    await prisma.learningMemory.create({
      data: {
        compiledText,
        bulletCount: uniqueBullets.length,
        sourceEntries: bullets.length,
      },
    });
  } catch (err) {
    console.error('[LearningMemory] Failed to persist:', err);
  }

  console.log(`[LearningMemory] Distilled ${uniqueBullets.length} patterns`);
  return compiledText;
}

/** Get the latest compiled Learning Memory block */
export async function getLatestLearningMemory(): Promise<string> {
  const latest = await prisma.learningMemory.findFirst({
    orderBy: { createdAt: 'desc' },
  });
  return latest?.compiledText || '';
}

// ─── Community Bias Corrections (A5) ──────────────────────────────────────────

/**
 * Compute per-occasion AI vs community score deltas.
 * Where community consistently rates an occasion higher/lower than AI by >= 0.5 points,
 * inject a correction directive into the prompt so the AI self-corrects its scoring bias.
 */
async function getCategoryBiasCorrections(): Promise<string> {
  try {
    const data = await prisma.outfitCheck.findMany({
      where: {
        aiScore: { not: null },
        communityAvgScore: { not: null },
        communityScoreCount: { gte: 3 },
        isDeleted: false,
      },
      select: { occasions: true, aiScore: true, communityAvgScore: true },
      take: 1000,
      orderBy: { createdAt: 'desc' },
    });

    const byOccasion = new Map<string, { ai: number[]; community: number[] }>();
    for (const d of data) {
      if (!d.aiScore || !d.communityAvgScore) continue;
      for (const occasion of d.occasions) {
        if (!byOccasion.has(occasion)) byOccasion.set(occasion, { ai: [], community: [] });
        const od = byOccasion.get(occasion)!;
        od.ai.push(d.aiScore);
        od.community.push(d.communityAvgScore);
      }
    }

    const corrections: string[] = [];
    for (const [occasion, od] of byOccasion) {
      if (od.ai.length < 10) continue; // Need enough data for reliable signal
      const avgAi = od.ai.reduce((s, v) => s + v, 0) / od.ai.length;
      const avgCommunity = od.community.reduce((s, v) => s + v, 0) / od.community.length;
      const delta = avgCommunity - avgAi; // positive = community rates higher than AI
      if (Math.abs(delta) >= 0.5) {
        const dir = delta > 0 ? 'higher' : 'lower';
        corrections.push(
          `The community rates "${occasion}" outfits ${Math.abs(delta).toFixed(1)} points ${dir} than AI baseline — adjust your scoring accordingly.`
        );
      }
    }

    if (corrections.length === 0) return '';
    return `\n\nCALIBRATION CORRECTIONS (platform-validated scoring adjustments):\n${corrections.map(c => `- ${c}`).join('\n')}`;
  } catch {
    return '';
  }
}
