/**
 * Critic Agent
 *
 * Reads Piggyback Judge scores from the Intelligence Bus, finds dimension-specific
 * weakness patterns, and produces structured critique reports mapped to PromptSection keys.
 *
 * Daily at 3am UTC. ~10K tokens.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { Prisma } from '@prisma/client';
import { prisma } from '../utils/prisma.js';
import { trackedGenerateContent } from './token-budget.service.js';
import { readFromIntelligenceBus, publishToIntelligenceBus } from './intelligence-bus.service.js';
import { hasLearningBudget } from './token-budget.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// Maps Judge dimensions to prompt section keys
const DIMENSION_TO_SECTION: Record<string, string[]> = {
  specificity: ['styling_moves', 'examples', 'analysis_scoring'],
  voiceConsistency: ['voice_persona', 'voice_examples'],
  actionability: ['styling_moves', 'examples'],
  styleAlignment: ['style_lanes', 'style_coherence'],
  occasionFit: ['occasion_dress_codes', 'seasonal_practical'],
};

interface WeaknessPattern {
  dimension: string;
  avgScore: number;
  affectedSections: string[];
  pattern: string;
  severity: number; // 1-5
}

interface CritiqueResult {
  weaknesses: WeaknessPattern[];
  topSection: string;
  topSeverity: number;
  summary: string;
}

/**
 * Main Critic run: reads last 7 days of Piggyback scores, finds patterns.
 * Returns critique result or null if budget exhausted.
 */
export async function runCriticAgent(): Promise<CritiqueResult | null> {
  if (!(await hasLearningBudget(1))) {
    console.log('[Critic] No learning budget available');
    return null;
  }

  console.log('[Critic] Starting analysis...');

  // Step 1: Pull last 7 days of Piggyback scores from bus
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const piggybackEntries = await readFromIntelligenceBus(
    'critic-agent',
    'piggyback_scores',
    { limit: 7, sinceDate: sevenDaysAgo }
  );

  if (piggybackEntries.length === 0) {
    console.log('[Critic] No piggyback scores available yet — skipping');
    return null;
  }

  // Step 2: Also pull raw outfit judge scores for bottom 20%
  const recentOutfits = await prisma.outfitCheck.findMany({
    where: {
      judgeEvaluated: true,
      judgeScores: { not: Prisma.JsonNull },
      isDeleted: false,
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      occasions: true,
      vibe: true,
      aiFeedback: true,
      judgeScores: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 50,
  });

  // Step 3: Identify dimension-specific weak outfits
  const dimensionWeakness: Record<string, number[]> = {
    specificity: [],
    voiceConsistency: [],
    actionability: [],
    styleAlignment: [],
    occasionFit: [],
  };

  for (const outfit of recentOutfits) {
    const scores = outfit.judgeScores as Record<string, number>;
    if (!scores) continue;
    for (const dim of Object.keys(dimensionWeakness)) {
      if ((scores[dim] || 7) < 6) {
        dimensionWeakness[dim].push(scores[dim]);
      }
    }
  }

  // Aggregate bus scores
  const aggDimScores: Record<string, number[]> = {
    specificity: [],
    voiceConsistency: [],
    actionability: [],
    styleAlignment: [],
    occasionFit: [],
  };

  for (const entry of piggybackEntries) {
    const agg = entry.payload.aggregate as Record<string, number>;
    if (!agg) continue;
    for (const dim of Object.keys(aggDimScores)) {
      if (agg[dim]) aggDimScores[dim].push(agg[dim]);
    }
  }

  // Find dimensions with avg < 7
  const weakDimensions: Array<{ dim: string; avg: number }> = [];
  for (const [dim, scores] of Object.entries(aggDimScores)) {
    if (scores.length === 0) continue;
    const avg = scores.reduce((a, b) => a + b, 0) / scores.length;
    if (avg < 7.5) {
      weakDimensions.push({ dim, avg });
    }
  }

  if (weakDimensions.length === 0) {
    console.log('[Critic] All dimensions scoring well (avg >= 7.5) — no critiques needed');
    return null;
  }

  // Sort by severity (lowest score first)
  weakDimensions.sort((a, b) => a.avg - b.avg);

  // Step 4: Get weak examples for top 2 weakest dimensions
  const topWeakDims = weakDimensions.slice(0, 2).map(w => w.dim);
  const weakOutfitExamples = recentOutfits
    .filter(o => {
      const scores = o.judgeScores as Record<string, number>;
      return topWeakDims.some(dim => (scores?.[dim] || 7) < 6);
    })
    .slice(0, 8);

  // Step 5: One batched Critic call (~10K tokens)
  const critiquePrompt = buildCritiquePrompt(weakDimensions, weakOutfitExamples);

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(
    model,
    critiquePrompt,
    10_000,
    'critic_analysis'
  );

  if (!result) {
    console.log('[Critic] Blocked by token budget');
    return null;
  }

  // Parse critique
  let critiqueData: any = null;
  try {
    const text = result.text.trim();
    const jsonMatch = text.match(/\{[\s\S]*\}/);
    if (jsonMatch) critiqueData = JSON.parse(jsonMatch[0]);
  } catch (err) {
    console.error('[Critic] Failed to parse critique:', err);
    return null;
  }

  // Build weakness patterns
  const weaknesses: WeaknessPattern[] = weakDimensions.map(({ dim, avg }) => ({
    dimension: dim,
    avgScore: avg,
    affectedSections: DIMENSION_TO_SECTION[dim] || [],
    pattern: critiqueData?.patterns?.[dim] || `${dim} scoring below threshold`,
    severity: Math.ceil((7.5 - avg) * 2), // Map score gap to 1-5 severity
  }));

  // Find highest-severity section to fix
  let topSection = 'voice_persona';
  let topSeverity = 0;

  for (const w of weaknesses) {
    if (w.severity > topSeverity && w.affectedSections.length > 0) {
      topSeverity = w.severity;
      topSection = w.affectedSections[0];
    }
  }

  const critiqueResult: CritiqueResult = {
    weaknesses,
    topSection,
    topSeverity,
    summary: critiqueData?.summary || `Found ${weaknesses.length} weak dimensions — ${topSection} needs most attention`,
  };

  // Step 6: Persist critique report
  const sectionMappings: Record<string, string[]> = {};
  const severityScores: Record<string, number> = {};
  for (const w of weaknesses) {
    for (const s of w.affectedSections) {
      sectionMappings[s] = sectionMappings[s] || [];
      sectionMappings[s].push(w.dimension);
      severityScores[s] = Math.max(severityScores[s] || 0, w.severity);
    }
  }

  await prisma.critiqueReport.create({
    data: {
      weaknesses: weaknesses as any,
      sectionMappings: sectionMappings as any,
      severityScores: severityScores as any,
      piggybackPeriod: `${sevenDaysAgo.toISOString().split('T')[0]} to ${new Date().toISOString().split('T')[0]}`,
    },
  });

  // Step 7: Publish to bus
  await publishToIntelligenceBus('critic-agent', 'critique_finding', {
    summary: critiqueResult.summary,
    topSection,
    topSeverity,
    weakDimensions: weakDimensions.map(w => w.dim),
    critiques: weaknesses.map(w => ({ section: w.affectedSections[0], dimension: w.dimension, severity: w.severity, pattern: w.pattern })),
  });

  console.log(`[Critic] Found ${weaknesses.length} weaknesses. Top: ${topSection} (severity ${topSeverity})`);
  return critiqueResult;
}

function buildCritiquePrompt(weakDimensions: Array<{ dim: string; avg: number }>, weakExamples: any[]): string {
  const dimList = weakDimensions.map(d => `- ${d.dim}: avg ${d.avg.toFixed(1)}/10`).join('\n');

  const examples = weakExamples.map((o, i) => {
    const feedback = o.aiFeedback as any;
    const scores = o.judgeScores as any;
    return `
Example ${i + 1}:
Occasion: ${(o.occasions || []).join(', ') || 'unspecified'}, Vibe: ${o.vibe || 'n/a'}
AI feedback: couldImprove: ${JSON.stringify(feedback?.couldImprove || [])}
takeItFurther: ${JSON.stringify(feedback?.takeItFurther || [])}
Judge scores: ${JSON.stringify(scores)}
`;
  }).join('\n---\n');

  return `You are analyzing patterns in AI fashion feedback quality. These dimensions are scoring below 7.5/10:

${dimList}

Here are ${weakExamples.length} weak analyses (grouped by their lowest dimension):
${examples}

Analyze WHY each dimension is weak. What patterns explain the low scores?

Return JSON:
{
  "patterns": {
    "${weakDimensions[0]?.dim || 'specificity'}": "<one sentence: what pattern causes low scores in this dimension>",
    "${weakDimensions[1]?.dim || 'voiceConsistency'}": "<one sentence pattern>"
  },
  "summary": "<one sentence overall critique summary>"
}`;
}

/** Get the highest-priority unaddressed critique */
export async function getTopUnaddressedCritique(): Promise<{
  sectionKey: string;
  dimension: string;
  severity: number;
  pattern: string;
} | null> {
  const report = await prisma.critiqueReport.findFirst({
    where: { addressed: false },
    orderBy: { createdAt: 'desc' },
  });

  if (!report) return null;

  const severityScores = report.severityScores as Record<string, number>;
  const sectionMappings = report.sectionMappings as Record<string, string[]>;
  const weaknesses = report.weaknesses as any[];

  // Find highest-severity section
  let topSection = '';
  let topSeverity = 0;
  for (const [section, severity] of Object.entries(severityScores)) {
    if (severity > topSeverity) {
      topSeverity = severity;
      topSection = section;
    }
  }

  if (!topSection) return null;

  const dimension = (sectionMappings[topSection] || [])[0] || 'specificity';
  const weakness = weaknesses.find(w => w.affectedSections?.includes(topSection));

  return {
    sectionKey: topSection,
    dimension,
    severity: topSeverity,
    pattern: weakness?.pattern || `${dimension} scoring below threshold`,
  };
}

/** Mark a critique report as addressed */
export async function markCritiqueAddressed(reportId?: string): Promise<void> {
  if (reportId) {
    await prisma.critiqueReport.update({
      where: { id: reportId },
      data: { addressed: true },
    });
  } else {
    // Mark the most recent unaddressed one
    const report = await prisma.critiqueReport.findFirst({
      where: { addressed: false },
      orderBy: { createdAt: 'desc' },
    });
    if (report) {
      await prisma.critiqueReport.update({
        where: { id: report.id },
        data: { addressed: true },
      });
    }
  }
}

/**
 * Follow-Up Critic: evaluates stored follow-up Q&A pairs.
 * Budget-gated at Priority 2 (~3pm UTC).
 */
export async function runFollowUpCritic(): Promise<void> {
  if (!(await hasLearningBudget(2))) {
    console.log('[FollowUpCritic] Budget priority 2 not met — skipping');
    return;
  }

  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
  const followUps = await prisma.followUp.findMany({
    where: {
      aiResponse: { not: null },
      createdAt: { gte: sevenDaysAgo },
    },
    select: {
      id: true,
      userQuestion: true,
      aiResponse: true,
    },
    take: 10,
  });

  if (followUps.length === 0) return;

  const prompt = `Evaluate these fashion follow-up Q&A pairs on 3 dimensions (1-10 each):
- contextual_relevance: Does the answer directly address the specific question?
- editorial_voice: Decisive, specific, no hedging?
- actionability: Concrete, usable advice?

${followUps.map((f, i) => `
Q${i + 1}: ${f.userQuestion}
A${i + 1}: ${f.aiResponse}
`).join('\n')}

Return JSON:
{
  "avgScores": {"contextual_relevance": <n>, "editorial_voice": <n>, "actionability": <n>},
  "weakestDimension": "<name>",
  "pattern": "<what causes weakness>"
}`;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.0-flash-lite' });
  const result = await trackedGenerateContent(model, prompt, 4_000, 'followup_critic');

  if (!result) return;

  let data: any = null;
  try {
    const jsonMatch = result.text.match(/\{[\s\S]*\}/);
    if (jsonMatch) data = JSON.parse(jsonMatch[0]);
  } catch { return; }

  if (data?.weakestDimension) {
    await publishToIntelligenceBus('followup-critic', 'critique_finding', {
      scope: 'followup',
      weakestDimension: data.weakestDimension,
      pattern: data.pattern,
      avgScores: data.avgScores,
      summary: `Follow-up ${data.weakestDimension} averaging below threshold`,
      sectionKey: `followup_${data.weakestDimension === 'contextual_relevance' ? 'context_rules' : data.weakestDimension === 'actionability' ? 'response_format' : 'persona'}`,
    });

    console.log(`[FollowUpCritic] Weakest: ${data.weakestDimension}`);
  }
}
