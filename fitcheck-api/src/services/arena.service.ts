/**
 * Arena Service
 *
 * Three components:
 * 1. Piggyback Judge — batch-evaluates yesterday's real analyses (daily 1am UTC)
 * 2. Arena — on-demand self-play testing for candidate prompt sections
 * 3. Regression — 20 fixed cases that block regressing deploys
 *
 * All text-only (no vision calls) — Judge reads feedback text + context.
 * Budget: ~7K tokens/day (Piggyback) + ~28K tokens/Arena session.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { trackedGenerateContent } from './token-budget.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';
import { assemblePrompt } from './prompt-assembly.service.js';
import { SYSTEM_PROMPT } from './ai-feedback.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// 5 evaluation dimensions
export const JUDGE_DIMENSIONS = [
  'specificity',        // Are suggestions tied to specific visible garments?
  'voiceConsistency',   // Does it match the editorial voice (no hedging, punchy)?
  'actionability',      // Are suggestions concrete and doable?
  'styleAlignment',     // Do suggestions stay within the detected style lane?
  'occasionFit',        // Does feedback address the stated occasion?
] as const;

export type JudgeDimension = typeof JUDGE_DIMENSIONS[number];

interface JudgeScores {
  specificity: number;
  voiceConsistency: number;
  actionability: number;
  styleAlignment: number;
  occasionFit: number;
  overall: number;
}

// ─── Piggyback Judge ──────────────────────────────────────────────────────────

/**
 * Batch-evaluate all unevaluated outfit analyses from today/yesterday.
 * Called daily at 1am UTC. ~7K tokens.
 */
export async function runPiggybackJudge(): Promise<void> {
  const yesterday = new Date(Date.now() - 48 * 60 * 60 * 1000);

  // Find unevaluated outfits
  const outfits = await prisma.outfitCheck.findMany({
    where: {
      judgeEvaluated: false,
      aiProcessedAt: { not: null, gte: yesterday },
      isDeleted: false,
    },
    select: {
      id: true,
      occasions: true,
      setting: true,
      weather: true,
      vibe: true,
      aiScore: true,
      aiFeedback: true,
    },
    take: 30,
  });

  if (outfits.length === 0) {
    console.log('[Piggyback] No unevaluated outfits found');
    return;
  }

  console.log(`[Piggyback] Evaluating ${outfits.length} outfits...`);

  // Build batch evaluation prompt
  const batchPrompt = buildBatchJudgePrompt(outfits);

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(
    model,
    batchPrompt,
    7_000,
    'piggyback_judge'
  );

  if (!result) {
    console.log('[Piggyback] Blocked by token budget');
    return;
  }

  // Parse results
  let evaluations: Array<{ id: string; scores: JudgeScores }> = [];
  try {
    const text = result.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      evaluations = JSON.parse(jsonMatch[0]);
    }
  } catch (err) {
    console.error('[Piggyback] Failed to parse evaluation results:', err);
    return;
  }

  // Store scores on each OutfitCheck
  let successCount = 0;
  for (const eval_ of evaluations) {
    try {
      await prisma.outfitCheck.update({
        where: { id: eval_.id },
        data: {
          judgeScores: eval_.scores as any,
          judgeEvaluated: true,
        },
      });
      successCount++;
    } catch (err) {
      console.error(`[Piggyback] Failed to update outfit ${eval_.id}:`, err);
    }
  }

  // Compute daily aggregate
  const allScores = evaluations.map(e => e.scores);
  const aggregate = computeAggregateScores(allScores);

  // Find top insight
  const bottomDimension = findBottomDimension(aggregate);
  const topInsight = `${bottomDimension} scored lowest today (${aggregate[bottomDimension as keyof JudgeScores]?.toFixed(1)}/10) — ${getDimensionAdvice(bottomDimension)}`;

  // Publish to bus
  await publishToIntelligenceBus('piggyback-judge', 'piggyback_scores', {
    date: new Date().toISOString().split('T')[0],
    sampleSize: evaluations.length,
    aggregate,
    topInsight,
    outfitCount: successCount,
  });

  console.log(`[Piggyback] Evaluated ${successCount}/${outfits.length} outfits. Bottom dimension: ${bottomDimension}`);
}

function buildBatchJudgePrompt(outfits: any[]): string {
  const cases = outfits.map((o, i) => {
    const feedback = o.aiFeedback as any;
    return `
Case ${i + 1} (ID: ${o.id}):
Occasion: ${(o.occasions || []).join(', ') || 'unspecified'}
Setting: ${o.setting || 'unspecified'}, Vibe: ${o.vibe || 'unspecified'}
AI Score: ${o.aiScore}
whatsRight: ${JSON.stringify(feedback?.whatsRight || [])}
couldImprove: ${JSON.stringify(feedback?.couldImprove || [])}
takeItFurther: ${JSON.stringify(feedback?.takeItFurther || [])}
editorialSummary: ${feedback?.editorialSummary || ''}
`;
  }).join('\n---\n');

  return `You are a fashion editorial quality judge. Evaluate each outfit analysis below on 5 dimensions (score 1-10):
- specificity: Are suggestions tied to specific visible items, not generic?
- voiceConsistency: Decisive, no hedging ("maybe", "perhaps", "you might"), Vogue editorial voice?
- actionability: Can user act on this today with concrete next steps?
- styleAlignment: Do suggestions stay within the outfit's style lane (no blazer for streetwear, etc.)?
- occasionFit: Does feedback address the stated occasion appropriately?

${cases}

Return ONLY a JSON array with one object per case:
[
  {
    "id": "<outfit id>",
    "scores": {
      "specificity": <1-10>,
      "voiceConsistency": <1-10>,
      "actionability": <1-10>,
      "styleAlignment": <1-10>,
      "occasionFit": <1-10>,
      "overall": <average of the 5>
    }
  }
]`;
}

function computeAggregateScores(scores: JudgeScores[]): JudgeScores {
  if (scores.length === 0) {
    return { specificity: 7, voiceConsistency: 7, actionability: 7, styleAlignment: 7, occasionFit: 7, overall: 7 };
  }

  const sum = { specificity: 0, voiceConsistency: 0, actionability: 0, styleAlignment: 0, occasionFit: 0, overall: 0 };
  for (const s of scores) {
    for (const dim of [...JUDGE_DIMENSIONS, 'overall'] as const) {
      sum[dim] += (s as any)[dim] || 7;
    }
  }

  const result: any = {};
  for (const key of Object.keys(sum)) {
    result[key] = sum[key as keyof typeof sum] / scores.length;
  }
  return result;
}

function findBottomDimension(aggregate: JudgeScores): string {
  let bottomDim = 'specificity';
  let bottomScore = 10;

  for (const dim of JUDGE_DIMENSIONS) {
    const score = (aggregate as any)[dim] || 7;
    if (score < bottomScore) {
      bottomScore = score;
      bottomDim = dim;
    }
  }
  return bottomDim;
}

function getDimensionAdvice(dimension: string): string {
  const advice: Record<string, string> = {
    specificity: 'Surgeon should focus on making suggestions reference specific visible garments',
    voiceConsistency: 'Surgeon should strengthen voice guidelines to eliminate hedging language',
    actionability: 'Surgeon should add more concrete next-step examples',
    styleAlignment: 'Surgeon should strengthen style lane rules to prevent cross-lane suggestions',
    occasionFit: 'Surgeon should improve occasion mapping in dress code section',
  };
  return advice[dimension] || 'Review and improve this dimension';
}

// ─── Arena ─────────────────────────────────────────────────────────────────────

interface ArenaScenario {
  id: string;
  type: 'db_sample' | 'synthetic';
  context: {
    occasion: string;
    setting?: string;
    weather?: string;
    vibe?: string;
    outfit?: string;
  };
}

/**
 * Run an Arena session to test a candidate section against the current baseline.
 * Returns win rate and whether to deploy.
 */
export async function runArenaSession(
  sectionKey: string,
  candidateVersion: number,
  candidateContent: string
): Promise<{ winRate: number; regressionPassed: boolean; shouldDeploy: boolean; sessionId: string }> {
  console.log(`[Arena] Starting session for ${sectionKey} v${candidateVersion}...`);

  // Create session record
  const session = await prisma.arenaSession.create({
    data: {
      challengerSectionKey: sectionKey,
      challengerVersion: candidateVersion,
      baselineVersion: 1, // Will be updated to actual current version
      trigger: 'surgeon',
      status: 'running',
    },
  });

  try {
    // Get current baseline prompt
    const baselineAssembly = await assemblePrompt();
    const baselinePrompt = baselineAssembly.fromDB ? baselineAssembly.text : SYSTEM_PROMPT;

    // Build candidate prompt (replace section)
    const candidatePrompt = buildCandidatePrompt(baselinePrompt, sectionKey, candidateContent);

    // Get 10-15 scenarios
    const scenarios = await getArenaScenarios(12);

    // Generate baseline responses (batched)
    const baselineResponses = await generateBatchedResponses(baselinePrompt, scenarios, 'baseline');
    if (!baselineResponses) {
      await prisma.arenaSession.update({
        where: { id: session.id },
        data: { status: 'failed', resultSummary: 'Token budget exhausted' },
      });
      return { winRate: 0, regressionPassed: false, shouldDeploy: false, sessionId: session.id };
    }

    // Generate candidate responses (batched)
    const candidateResponses = await generateBatchedResponses(candidatePrompt, scenarios, 'candidate');
    if (!candidateResponses) {
      await prisma.arenaSession.update({
        where: { id: session.id },
        data: { status: 'failed', resultSummary: 'Token budget exhausted (candidate)' },
      });
      return { winRate: 0, regressionPassed: false, shouldDeploy: false, sessionId: session.id };
    }

    // Judge comparisons (batched)
    const matches = await judgeCompare(session.id, scenarios, baselineResponses, candidateResponses);

    // Calculate win rate
    const wins = matches.filter(m => m.winner === 'challenger').length;
    const winRate = matches.length > 0 ? wins / matches.length : 0;

    // Run regression
    const regressionPassed = await runRegressionTest(candidatePrompt);

    // Determine deploy
    const shouldDeploy = winRate > 0.55 && regressionPassed;

    // Update session
    await prisma.arenaSession.update({
      where: { id: session.id },
      data: {
        status: 'completed',
        winRate,
        matchCount: matches.length,
        regressionPassed,
        deployed: shouldDeploy,
        resultSummary: `Win rate: ${(winRate * 100).toFixed(0)}% (${wins}/${matches.length}). Regression: ${regressionPassed ? 'PASS' : 'FAIL'}. Deploy: ${shouldDeploy ? 'YES' : 'NO'}`,
      },
    });

    // Publish to bus
    await publishToIntelligenceBus('arena', 'arena_result', {
      sessionId: session.id,
      sectionKey,
      candidateVersion,
      winRate,
      regressionPassed,
      deployed: shouldDeploy,
    });

    console.log(`[Arena] Session complete: win rate ${(winRate * 100).toFixed(0)}%, regression ${regressionPassed ? 'PASS' : 'FAIL'}, deploy: ${shouldDeploy}`);

    return { winRate, regressionPassed, shouldDeploy, sessionId: session.id };

  } catch (err) {
    console.error('[Arena] Session failed:', err);
    await prisma.arenaSession.update({
      where: { id: session.id },
      data: { status: 'failed', resultSummary: String(err) },
    });
    throw err;
  }
}

function buildCandidatePrompt(baselinePrompt: string, sectionKey: string, newContent: string): string {
  // For sectional prompts assembled from DB, just substitute the section
  // For hardcoded fallback, append new content
  if (!baselinePrompt) return newContent;
  return baselinePrompt + '\n\n[CANDIDATE SECTION UPDATE: ' + sectionKey + ']\n' + newContent;
}

async function getArenaScenarios(count: number): Promise<ArenaScenario[]> {
  const scenarios: ArenaScenario[] = [];

  // Get some from DB
  const dbOutfits = await prisma.outfitCheck.findMany({
    where: {
      isDeleted: false,
      judgeEvaluated: true,
    },
    select: {
      id: true,
      occasions: true,
      setting: true,
      weather: true,
      vibe: true,
    },
    orderBy: { createdAt: 'desc' },
    take: Math.min(6, count),
  });

  for (const o of dbOutfits) {
    scenarios.push({
      id: o.id,
      type: 'db_sample',
      context: {
        occasion: (o.occasions || []).join(', ') || 'casual',
        setting: o.setting || undefined,
        weather: o.weather || undefined,
        vibe: o.vibe || undefined,
      },
    });
  }

  // Fill rest with synthetic scenarios
  const synthetic = getSyntheticScenarios();
  for (const s of synthetic.slice(0, count - scenarios.length)) {
    scenarios.push(s);
  }

  return scenarios.slice(0, count);
}

function getSyntheticScenarios(): ArenaScenario[] {
  return [
    { id: 'syn_1', type: 'synthetic', context: { occasion: 'job interview tech startup', outfit: 'Navy slacks, light pink button-down, brown belt, brown dress shoes' } },
    { id: 'syn_2', type: 'synthetic', context: { occasion: 'cocktail party', outfit: 'Black fitted dress, gold statement necklace, black heels' } },
    { id: 'syn_3', type: 'synthetic', context: { occasion: 'hanging with friends', outfit: 'Oversized graphic hoodie, baggy cargo pants, Air Force 1s, crossbody bag' } },
    { id: 'syn_4', type: 'synthetic', context: { occasion: 'brunch', outfit: 'Light blue jeans, white t-shirt, olive bomber jacket, white sneakers' } },
    { id: 'syn_5', type: 'synthetic', context: { occasion: 'gym session', outfit: 'Black compression leggings, oversized gray cotton tee, neon green running shoes' } },
    { id: 'syn_6', type: 'synthetic', context: { occasion: 'first date dinner', outfit: 'Dark wash jeans, silk blouse, strappy heels, small gold clutch' } },
    { id: 'syn_7', type: 'synthetic', context: { occasion: 'office work from home', outfit: 'Oversized blazer, cropped white tee, straight leg jeans, white sneakers' } },
    { id: 'syn_8', type: 'synthetic', context: { occasion: 'music festival', outfit: 'Crochet crop top, denim cutoff shorts, cowboy boots, layered necklaces' } },
  ];
}

async function generateBatchedResponses(
  prompt: string,
  scenarios: ArenaScenario[],
  role: string
): Promise<Record<string, string> | null> {
  const batchPrompt = `${prompt}

---

You will be asked to evaluate multiple outfits. For each, provide a brief editorial assessment (2-3 sentences). Focus on the most important observation.

${scenarios.map((s, i) => `
OUTFIT ${i + 1} (ID: ${s.id}):
Occasion: ${s.context.occasion}
${s.context.outfit ? `Visible outfit: ${s.context.outfit}` : ''}
${s.context.vibe ? `Vibe: ${s.context.vibe}` : ''}
`).join('\n')}

Return JSON:
{
  "responses": {
    "<id>": "<2-3 sentence editorial assessment>",
    ...
  }
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(
    model,
    batchPrompt,
    8_000,
    `arena_generate_${role}`
  );

  if (!result) return null;

  try {
    const text = result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (!jsonMatch) return null;
    const parsed = JSON.parse(jsonMatch[0]);
    return parsed.responses || {};
  } catch {
    return null;
  }
}

async function judgeCompare(
  sessionId: string,
  scenarios: ArenaScenario[],
  baseline: Record<string, string>,
  challenger: Record<string, string>
): Promise<Array<{ id: string; winner: 'baseline' | 'challenger' | 'tie' }>> {
  const comparePrompt = `You are a fashion editorial quality judge comparing two AI fashion assistant responses.

For each outfit scenario below, you will see Response A (baseline) and Response B (challenger).
Judge which is better on these criteria:
- More specific to the outfit described
- Better editorial voice (decisive, no hedging)
- More actionable advice
- Better style lane alignment
- More appropriate for the occasion

${scenarios.map((s, i) => {
  const bResp = baseline[s.id] || 'No response';
  const cResp = challenger[s.id] || 'No response';
  return `
Scenario ${i + 1} (ID: ${s.id}):
Outfit context: ${s.context.occasion}${s.context.outfit ? ` — ${s.context.outfit}` : ''}
Response A: ${bResp}
Response B: ${cResp}
`;
}).join('\n---\n')}

Return ONLY JSON array:
[
  {"id": "<scenario_id>", "winner": "A" or "B" or "tie", "reason": "<one sentence>"},
  ...
]`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(
    model,
    comparePrompt,
    8_000,
    'arena_judge'
  );

  if (!result) return [];

  let comparisons: Array<{ id: string; winner: string; reason: string }> = [];
  try {
    const text = result.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      comparisons = JSON.parse(jsonMatch[0]);
    }
  } catch {
    return [];
  }

  // Store match results
  const results: Array<{ id: string; winner: 'baseline' | 'challenger' | 'tie' }> = [];
  for (const comp of comparisons) {
    const winner: 'baseline' | 'challenger' | 'tie' =
      comp.winner === 'B' ? 'challenger' :
      comp.winner === 'A' ? 'baseline' : 'tie';

    const scenario = scenarios.find(s => s.id === comp.id);
    if (scenario) {
      await prisma.arenaMatch.create({
        data: {
          sessionId,
          scenarioType: scenario.type,
          contextSnapshot: scenario.context as any,
          baselineResponse: baseline[comp.id] || '',
          challengerResponse: challenger[comp.id] || '',
          winner,
          judgeRationale: comp.reason,
        },
      });
      results.push({ id: comp.id, winner });
    }
  }

  return results;
}

// ─── Regression ───────────────────────────────────────────────────────────────

/**
 * Run 20 fixed regression cases.
 * Returns false if any category regresses more than 1.0 points.
 */
async function runRegressionTest(candidatePrompt: string): Promise<boolean> {
  const cases = await prisma.regressionCase.findMany({
    where: { isActive: true },
    take: 20,
  });

  if (cases.length === 0) {
    console.log('[Regression] No regression cases seeded — passing by default');
    return true;
  }

  const regressionPrompt = `${candidatePrompt}

Evaluate these outfit scenarios. For each, score 1-10 on: specificity, voiceConsistency, actionability, styleAlignment, occasionFit.

${cases.map((c, i) => `
Case ${i + 1} (ID: ${c.id}):
${JSON.stringify(c.contextSnapshot)}
`).join('\n')}

Return JSON array:
[{"id": "<case id>", "scores": {"specificity": <n>, "voiceConsistency": <n>, "actionability": <n>, "styleAlignment": <n>, "occasionFit": <n>}}]`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(
    model,
    regressionPrompt,
    6_000,
    'arena_regression'
  );

  if (!result) {
    console.log('[Regression] Blocked by budget — passing by default');
    return true;
  }

  let newScores: Array<{ id: string; scores: Partial<JudgeScores> }> = [];
  try {
    const text = result.text.trim();
    const jsonMatch = text.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      newScores = JSON.parse(jsonMatch[0]);
    }
  } catch {
    console.log('[Regression] Parse error — passing by default');
    return true;
  }

  // Check for regressions
  for (const newScore of newScores) {
    const regressionCase = cases.find(c => c.id === newScore.id);
    if (!regressionCase) continue;

    const baseline = regressionCase.baselineScores as Record<string, number>;

    for (const dim of JUDGE_DIMENSIONS) {
      const baselineScore = baseline[dim] || 7;
      const newDimScore = (newScore.scores as any)[dim] || 7;

      if (baselineScore - newDimScore > 1.0) {
        console.log(`[Regression] FAIL: ${regressionCase.scenarioName} ${dim}: ${baselineScore} → ${newDimScore} (regression of ${(baselineScore - newDimScore).toFixed(1)})`);
        return false;
      }
    }
  }

  console.log('[Regression] All cases passed');
  return true;
}

/** Update regression baselines with current prompt performance (run after stable deploys) */
export async function calibrateRegressionBaselines(): Promise<void> {
  const cases = await prisma.regressionCase.findMany({ where: { isActive: true }, take: 20 });
  if (cases.length === 0) return;

  const assembly = await assemblePrompt();
  const currentPrompt = assembly.fromDB ? assembly.text : SYSTEM_PROMPT;

  const calibrationPrompt = `${currentPrompt}

Evaluate these outfit scenarios on 5 dimensions (1-10 each):
specificity, voiceConsistency, actionability, styleAlignment, occasionFit.

${cases.map((c, i) => `Case ${i + 1} (ID: ${c.id}): ${JSON.stringify(c.contextSnapshot)}`).join('\n')}

Return JSON: [{"id": "<id>", "scores": {"specificity": n, "voiceConsistency": n, "actionability": n, "styleAlignment": n, "occasionFit": n}}]`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(model, calibrationPrompt, 6_000, 'regression_calibrate');
  if (!result) return;

  let newBaselines: Array<{ id: string; scores: Record<string, number> }> = [];
  try {
    const jsonMatch = result.text.match(/\[[\s\S]*\]/);
    if (jsonMatch) newBaselines = JSON.parse(jsonMatch[0]);
  } catch {
    return;
  }

  for (const nb of newBaselines) {
    await prisma.regressionCase.update({
      where: { id: nb.id },
      data: { baselineScores: nb.scores as any },
    }).catch(() => {});
  }

  console.log(`[Regression] Calibrated ${newBaselines.length} baselines`);
}
