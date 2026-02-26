/**
 * Surgeon Agent
 *
 * Two modes:
 * A. Reactive: fixes highest-severity Critic finding → Arena → deploy if wins
 * B. Proactive mutation: explores random section improvements → Arena → deploy if wins
 *
 * Also runs weekly Example Rotation (Sundays).
 * Daily at 5am UTC. ~35-42K tokens.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { trackedGenerateContent, hasLearningBudget } from './token-budget.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { getSection, createSectionVersion, activateSectionVersion, recordFailedAttempt, SECTION_KEYS } from './prompt-assembly.service.js';
import { runArenaSession } from './arena.service.js';
import { getTopUnaddressedCritique, markCritiqueAddressed } from './critic-agent.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Reactive Mode ─────────────────────────────────────────────────────────────

/**
 * Main Surgeon run: reactive fix + proactive mutation.
 * Called daily at 5am UTC.
 */
export async function runSurgeonAgent(): Promise<void> {
  if (!(await hasLearningBudget(1))) {
    console.log('[Surgeon] No learning budget (P1) — skipping');
    return;
  }

  console.log('[Surgeon] Starting daily run...');

  // Step 1: Try reactive fix
  const critique = await getTopUnaddressedCritique();

  if (critique) {
    console.log(`[Surgeon] Reactive mode: fixing ${critique.sectionKey} (${critique.dimension}, severity ${critique.severity})`);
    await runReactiveFix(critique);
  }

  // Step 2: Proactive mutation (if budget allows)
  if (await hasLearningBudget(2)) {
    console.log('[Surgeon] Proactive mutation mode...');
    await runProactiveMutation();
  }
}

/**
 * Evening 2nd-pass Surgeon (Priority 3 — 7pm UTC).
 * Reactive fix OR additional mutation.
 */
export async function runSurgeonAgentEvening(): Promise<void> {
  if (!(await hasLearningBudget(3))) {
    console.log('[Surgeon Evening] Budget priority 3 not met — skipping');
    return;
  }

  console.log('[Surgeon Evening] Starting 2nd-pass...');

  const critique = await getTopUnaddressedCritique();
  if (critique) {
    await runReactiveFix(critique);
  } else {
    await runProactiveMutation();
  }
}

/**
 * Additional mutations for Priority 4 (9pm UTC — 2 more mutations if budget > 250K).
 */
export async function runAdditionalMutations(): Promise<void> {
  if (!(await hasLearningBudget(4))) {
    console.log('[Surgeon P4] Budget not met — skipping');
    return;
  }

  console.log('[Surgeon P4] Running additional proactive mutations...');
  await runProactiveMutation();
  await runProactiveMutation();
}

// ─── Reactive fix ─────────────────────────────────────────────────────────────

async function runReactiveFix(critique: {
  sectionKey: string;
  dimension: string;
  severity: number;
  pattern: string;
}): Promise<boolean> {
  // Get current section
  const current = await getSection(critique.sectionKey);
  if (!current) {
    console.log(`[Surgeon] Section ${critique.sectionKey} not found in DB — skipping`);
    return false;
  }

  // Read genealogy to avoid repeating failed approaches
  const failedAttempts = current.failedAttempts as Array<{ changelog: string; failReason: string }>;
  const failedSummary = failedAttempts.length > 0
    ? `Previous failed attempts:\n${failedAttempts.map(f => `- ${f.changelog}: failed because ${f.failReason}`).join('\n')}`
    : '';

  // Generate targeted edit
  const editPrompt = `You are improving a specific section of an AI fashion editorial system prompt.

SECTION TO IMPROVE: "${critique.sectionKey}"
CURRENT CONTENT:
${current.content}

IDENTIFIED WEAKNESS: The "${critique.dimension}" dimension is scoring below threshold.
PATTERN FOUND BY CRITIC: ${critique.pattern}

${failedSummary}

Write an IMPROVED VERSION of this section that specifically addresses this weakness.
The improvement must:
1. Fix the identified pattern/weakness
2. Not degrade other dimensions
3. Stay consistent with the editorial voice (Vogue-level, decisive, no hedging)
4. Not repeat approaches that already failed

Return JSON:
{
  "improvedContent": "<the improved section text>",
  "changelog": "<one sentence: what changed and why>",
  "rationale": "<one sentence: why this will fix the weakness>"
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(
    model,
    editPrompt,
    7_000,
    'surgeon_reactive'
  );

  if (!result) {
    console.log('[Surgeon] Reactive fix blocked by budget');
    return false;
  }

  let editData: { improvedContent: string; changelog: string; rationale: string } | null = null;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) editData = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[Surgeon] Failed to parse edit:', err);
    return false;
  }

  if (!editData?.improvedContent) {
    console.log('[Surgeon] No improved content in response');
    return false;
  }

  // Create new version
  const { version } = await createSectionVersion(
    critique.sectionKey,
    editData.improvedContent,
    'surgeon-reactive',
    editData.changelog,
    current.version
  );

  // Test via Arena
  const { winRate, regressionPassed, shouldDeploy } = await runArenaSession(
    critique.sectionKey,
    version,
    editData.improvedContent
  );

  if (shouldDeploy) {
    // Deploy
    await activateSectionVersion(critique.sectionKey, version, winRate);
    await markCritiqueAddressed();

    await publishToIntelligenceBus('surgeon', 'mutation_result', {
      mode: 'reactive',
      sectionKey: critique.sectionKey,
      version,
      winRate,
      changelog: editData.changelog,
      insight: `Fixed ${critique.dimension} in ${critique.sectionKey}: ${editData.changelog}`,
    });

    console.log(`[Surgeon] Deployed reactive fix: ${critique.sectionKey} v${version} (win rate ${(winRate * 100).toFixed(0)}%)`);
    return true;
  } else {
    // Record failure
    await recordFailedAttempt(
      critique.sectionKey,
      editData.changelog,
      regressionPassed
        ? `Lost Arena (win rate ${(winRate * 100).toFixed(0)}% < 55%)`
        : 'Failed regression test'
    );

    console.log(`[Surgeon] Reactive fix rejected: ${critique.sectionKey} (${regressionPassed ? 'Arena loss' : 'regression fail'})`);
    return false;
  }
}

// ─── Proactive mutation ────────────────────────────────────────────────────────

async function runProactiveMutation(): Promise<boolean> {
  // Select a random section (weighted toward sections not improved recently)
  const sectionKey = await selectMutationTarget();
  if (!sectionKey) return false;

  const current = await getSection(sectionKey);
  if (!current) return false;

  const failedAttempts = current.failedAttempts as Array<{ changelog: string; failReason: string }>;
  const failedSummary = failedAttempts.length > 0
    ? `\nPrevious failed mutations (avoid these directions):\n${failedAttempts.slice(-3).map(f => `- ${f.changelog}`).join('\n')}`
    : '';

  const mutationPrompt = `You are improving a section of an AI fashion editorial system prompt.

SECTION: "${sectionKey}"
CURRENT CONTENT:
${current.content}

GOAL: Generate 2 variant improvements. Focus on ONE of these approaches:
- Make suggestions more specific and actionable (less generic)
- Strengthen editorial voice (more decisive, more fashion vocabulary)
- Add more concrete examples for edge cases
- Clarify rules that might cause ambiguous behavior
${failedSummary}

Return JSON:
{
  "variant1": {
    "content": "<improved version>",
    "changelog": "<one sentence what changed>",
    "approach": "<which of the 4 approaches above>"
  },
  "variant2": {
    "content": "<second improved version>",
    "changelog": "<different approach from variant1>",
    "approach": "<different approach>"
  }
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(
    model,
    mutationPrompt,
    7_000,
    'surgeon_mutation'
  );

  if (!result) return false;

  let mutationData: { variant1: any; variant2: any } | null = null;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) mutationData = JSON.parse(jsonMatch[0]);
  } catch {
    return false;
  }

  if (!mutationData?.variant1?.content) return false;

  // Test variant1 via Arena (pick first, then try second if first loses)
  const variant = mutationData.variant1;

  const { version } = await createSectionVersion(
    sectionKey,
    variant.content,
    'surgeon-mutation',
    variant.changelog,
    current.version
  );

  const { winRate, regressionPassed, shouldDeploy } = await runArenaSession(
    sectionKey,
    version,
    variant.content
  );

  if (shouldDeploy) {
    await activateSectionVersion(sectionKey, version, winRate);

    await publishToIntelligenceBus('surgeon', 'mutation_result', {
      mode: 'proactive',
      sectionKey,
      version,
      winRate,
      changelog: variant.changelog,
      approach: variant.approach,
      insight: `Proactive improvement to ${sectionKey}: ${variant.changelog}`,
    });

    console.log(`[Surgeon] Deployed proactive mutation: ${sectionKey} v${version} (win rate ${(winRate * 100).toFixed(0)}%)`);
    return true;
  } else {
    await recordFailedAttempt(
      sectionKey,
      variant.changelog,
      regressionPassed ? 'Arena loss' : 'Regression fail'
    );

    // Try variant 2 if variant 1 failed
    if (mutationData.variant2?.content) {
      const v2 = mutationData.variant2;
      const { version: v2version } = await createSectionVersion(
        sectionKey,
        v2.content,
        'surgeon-mutation',
        v2.changelog,
        current.version
      );

      const v2result = await runArenaSession(sectionKey, v2version, v2.content);

      if (v2result.shouldDeploy) {
        await activateSectionVersion(sectionKey, v2version, v2result.winRate);
        await publishToIntelligenceBus('surgeon', 'mutation_result', {
          mode: 'proactive_v2',
          sectionKey,
          version: v2version,
          winRate: v2result.winRate,
          changelog: v2.changelog,
          insight: `Proactive improvement (v2) to ${sectionKey}: ${v2.changelog}`,
        });
        console.log(`[Surgeon] Deployed proactive mutation v2: ${sectionKey} v${v2version}`);
        return true;
      } else {
        await recordFailedAttempt(sectionKey, v2.changelog, 'Arena loss (v2)');
      }
    }

    console.log(`[Surgeon] Proactive mutation rejected for ${sectionKey}`);
    return false;
  }
}

/**
 * Select which section to mutate (weighted toward sections not improved recently).
 */
async function selectMutationTarget(): Promise<string | null> {
  // Get sections ordered by when they were last mutated
  const sections = await prisma.promptSection.findMany({
    where: {
      isActive: true,
      sectionKey: { in: [...SECTION_KEYS] },
    },
    select: { sectionKey: true, version: true, createdAt: true },
    orderBy: { createdAt: 'asc' }, // Oldest first = highest priority
  });

  if (sections.length === 0) return null;

  // Weighted random: older sections get higher weight
  const weights = sections.map((_, i) => sections.length - i);
  const totalWeight = weights.reduce((a, b) => a + b, 0);
  let random = Math.random() * totalWeight;

  for (let i = 0; i < sections.length; i++) {
    random -= weights[i];
    if (random <= 0) return sections[i].sectionKey;
  }

  return sections[0].sectionKey;
}

// ─── Follow-Up Surgeon ─────────────────────────────────────────────────────────

/**
 * Follow-Up Surgeon: improves follow-up prompt sections.
 * Budget-gated at Priority 3 (~5pm UTC).
 */
export async function runFollowUpSurgeon(): Promise<void> {
  if (!(await hasLearningBudget(3))) {
    console.log('[FollowUpSurgeon] Budget P3 not met — skipping');
    return;
  }

  // Get the weakest follow-up section from Critic bus entries
  const { readFromIntelligenceBus } = await import('./intelligence-bus.service.js');
  const recentCritiques = await readFromIntelligenceBus(
    'followup-surgeon',
    'critique_finding',
    { limit: 5 }
  );

  const followupCritique = recentCritiques.find(
    e => e.payload.scope === 'followup' && e.payload.sectionKey
  );

  if (!followupCritique) {
    console.log('[FollowUpSurgeon] No follow-up critique found — running proactive mutation');
    await runFollowUpMutation();
    return;
  }

  const sectionKey = followupCritique.payload.sectionKey as string;
  const current = await getSection(sectionKey);

  if (!current) return;

  const editPrompt = `You are improving a follow-up conversation section of an AI fashion assistant prompt.

SECTION: "${sectionKey}"
CURRENT CONTENT:
${current.content}

WEAKNESS: ${followupCritique.payload.weakestDimension} is scoring below threshold.
PATTERN: ${followupCritique.payload.pattern}

Improve this section to specifically address the weakness.

Return JSON:
{
  "improvedContent": "<improved section>",
  "changelog": "<what changed and why>"
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(model, editPrompt, 5_000, 'followup_surgeon');
  if (!result) return;

  let data: any = null;
  try {
    const match = result.text.match(/\{[\s\S]*\}/);
    if (match) data = JSON.parse(match[0]);
  } catch { return; }

  if (!data?.improvedContent) return;

  const { version } = await createSectionVersion(
    sectionKey,
    data.improvedContent,
    'surgeon-reactive',
    data.changelog,
    current.version
  );

  const { shouldDeploy, winRate } = await runArenaSession(sectionKey, version, data.improvedContent);

  if (shouldDeploy) {
    await activateSectionVersion(sectionKey, version, winRate);
    console.log(`[FollowUpSurgeon] Deployed: ${sectionKey} v${version}`);
  }
}

async function runFollowUpMutation(): Promise<void> {
  const followupSections = ['followup_persona', 'followup_context_rules', 'followup_response_format'];
  const randomKey = followupSections[Math.floor(Math.random() * followupSections.length)];

  const current = await getSection(randomKey);
  if (!current) return;

  const mutationPrompt = `Improve this follow-up conversation section of an AI fashion assistant:

SECTION: "${randomKey}"
CURRENT:
${current.content}

Make it more specific, more editorial, or add clearer response guidelines.

Return JSON:
{
  "improvedContent": "<improved version>",
  "changelog": "<what changed>"
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(model, mutationPrompt, 4_000, 'followup_mutation');
  if (!result) return;

  let data: any = null;
  try {
    const match = result.text.match(/\{[\s\S]*\}/);
    if (match) data = JSON.parse(match[0]);
  } catch { return; }

  if (!data?.improvedContent) return;

  const { version } = await createSectionVersion(
    randomKey,
    data.improvedContent,
    'surgeon-mutation',
    data.changelog,
    current.version
  );

  const { shouldDeploy, winRate } = await runArenaSession(randomKey, version, data.improvedContent);
  if (shouldDeploy) {
    await activateSectionVersion(randomKey, version, winRate);
    console.log(`[FollowUpSurgeon] Deployed mutation: ${randomKey} v${version}`);
  }
}

// ─── Example Rotation (weekly, Sundays) ───────────────────────────────────────

/**
 * Weekly: check if examples section needs updating based on weak style lanes.
 * ~14K tokens/week.
 */
export async function runExampleRotation(): Promise<void> {
  if (!(await hasLearningBudget(2))) return;

  console.log('[ExampleRotation] Checking if examples need rotation...');

  // Find weakest style lanes from recent piggyback scores
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const recentOutfits = await prisma.outfitCheck.findMany({
    where: {
      judgeEvaluated: true,
      isDeleted: false,
      createdAt: { gte: sevenDaysAgo },
    },
    select: { vibe: true, judgeScores: true },
    take: 30,
  });

  // Find which vibes score lowest
  const vibeScores: Record<string, number[]> = {};
  for (const o of recentOutfits) {
    if (!o.vibe || !o.judgeScores) continue;
    const scores = o.judgeScores as Record<string, number>;
    vibeScores[o.vibe] = vibeScores[o.vibe] || [];
    vibeScores[o.vibe].push(scores.overall || 7);
  }

  const weakestVibe = Object.entries(vibeScores)
    .map(([vibe, scores]) => ({ vibe, avg: scores.reduce((a, b) => a + b, 0) / scores.length }))
    .sort((a, b) => a.avg - b.avg)[0];

  if (!weakestVibe || weakestVibe.avg > 7) {
    console.log('[ExampleRotation] All vibes scoring well — skipping');
    return;
  }

  // Get current examples section
  const current = await getSection('examples');
  if (!current) return;

  const rotationPrompt = `You are improving the examples section of an AI fashion assistant prompt.

CURRENT EXAMPLES SECTION:
${current.content}

The weakest performing style lane is: "${weakestVibe.vibe}" (avg score ${weakestVibe.avg.toFixed(1)}/10).

If the current examples don't include a strong example of this style lane, generate a new one and replace the weakest existing example.

Return JSON:
{
  "needsUpdate": <true/false>,
  "updatedContent": "<full updated examples section if needsUpdate, otherwise same as current>",
  "changelog": "<what was replaced and why>"
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(model, rotationPrompt, 7_000, 'example_rotation');
  if (!result) return;

  let data: any = null;
  try {
    const match = result.text.match(/\{[\s\S]*\}/);
    if (match) data = JSON.parse(match[0]);
  } catch { return; }

  if (!data?.needsUpdate) {
    console.log('[ExampleRotation] No update needed');
    return;
  }

  const { version } = await createSectionVersion(
    'examples',
    data.updatedContent,
    'surgeon-mutation',
    data.changelog,
    current.version
  );

  const { shouldDeploy, winRate } = await runArenaSession('examples', version, data.updatedContent);
  if (shouldDeploy) {
    await activateSectionVersion('examples', version, winRate);
    console.log(`[ExampleRotation] Deployed: examples v${version} — ${data.changelog}`);
  }
}
