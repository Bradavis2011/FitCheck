/**
 * Recursive Self-Improvement Service
 *
 * Closed-loop system that automatically improves the AI styling prompt:
 *
 * 1. MEASURE  — Aggregate performance metrics from real user interactions
 * 2. DISCOVER — Extract new fashion rules from StyleDNA patterns
 * 3. DIAGNOSE — Identify weaknesses using Gemini meta-analysis
 * 4. IMPROVE  — Generate an improved prompt candidate
 * 5. TEST     — Deploy candidate via A/B test
 * 6. PROMOTE  — Auto-promote winner based on metrics
 *
 * Each cycle's output (better prompt + new knowledge) feeds into the next cycle,
 * making the system recursively self-improving.
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';
import { SYSTEM_PROMPT, PROMPT_VERSION } from './ai-feedback.service.js';
import { publishToIntelligenceBus } from './intelligence-bus.service.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

// ─── Types ──────────────────────────────────────────────────────────────────

interface PerformanceMetrics {
  promptVersion: string;
  sampleSize: number;
  avgAiScore: number | null;
  avgUserRating: number | null;
  avgCommunityDelta: number | null;
  helpfulPct: number | null;
  fallbackRate: number | null;
}

interface DiscoveredFashionRule {
  category: string;
  rule: string;
  confidence: number;
  sampleSize: number;
  evidence: string;
}

interface WeaknessReport {
  weaknesses: string[];
  lowPerformingOccasions: string[];
  calibrationIssues: string[];
  userComplaints: string[];
}

// ─── Step 1: MEASURE — Aggregate performance from real user data ────────────

async function measurePromptPerformance(version?: string): Promise<PerformanceMetrics> {
  const where: any = {
    aiProcessedAt: { not: null },
    isDeleted: false,
  };
  if (version) {
    where.promptVersion = version;
  }

  const outfits = await prisma.outfitCheck.findMany({
    where,
    select: {
      aiScore: true,
      feedbackRating: true,
      feedbackHelpful: true,
      communityAvgScore: true,
      communityScoreCount: true,
      promptVersion: true,
      aiFeedback: true,
    },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  if (outfits.length === 0) {
    return {
      promptVersion: version || PROMPT_VERSION,
      sampleSize: 0,
      avgAiScore: null,
      avgUserRating: null,
      avgCommunityDelta: null,
      helpfulPct: null,
      fallbackRate: null,
    };
  }

  // AI score average
  const scored = outfits.filter(o => o.aiScore !== null);
  const avgAiScore = scored.length > 0
    ? scored.reduce((sum, o) => sum + o.aiScore!, 0) / scored.length
    : null;

  // User rating average
  const rated = outfits.filter(o => o.feedbackRating !== null);
  const avgUserRating = rated.length > 0
    ? rated.reduce((sum, o) => sum + o.feedbackRating!, 0) / rated.length
    : null;

  // Community delta (how close AI is to community consensus)
  const withCommunity = outfits.filter(o =>
    o.aiScore !== null && o.communityAvgScore !== null && o.communityScoreCount >= 3
  );
  const avgCommunityDelta = withCommunity.length > 0
    ? withCommunity.reduce((sum, o) => sum + Math.abs(o.aiScore! - o.communityAvgScore!), 0) / withCommunity.length
    : null;

  // Helpful percentage
  const helpfulVoted = outfits.filter(o => o.feedbackHelpful !== null);
  const helpfulPct = helpfulVoted.length > 0
    ? helpfulVoted.filter(o => o.feedbackHelpful === true).length / helpfulVoted.length
    : null;

  // Fallback rate (feedback is the generic fallback object)
  const fallbacks = outfits.filter(o => {
    const fb = o.aiFeedback as any;
    return fb?.summary?.includes('having trouble analyzing') || fb?.summary?.includes('technical difficulties');
  });
  const fallbackRate = fallbacks.length / outfits.length;

  return {
    promptVersion: version || PROMPT_VERSION,
    sampleSize: outfits.length,
    avgAiScore,
    avgUserRating,
    avgCommunityDelta,
    helpfulPct,
    fallbackRate,
  };
}

// ─── B1: Mine follow-up questions for prompt gaps ────────────────────────────

/**
 * Cluster recent follow-up questions to find what the AI feedback didn't address.
 * High-volume follow-up topics = prompt gaps. Injects findings into diagnoseWeaknesses().
 * ~3K tokens/week when called from improvement cycle.
 */
export async function mineFollowUpGaps(): Promise<string[]> {
  const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 60 * 60 * 1000);

  const followUps = await prisma.followUp.findMany({
    where: { createdAt: { gte: twoWeeksAgo } },
    select: { userQuestion: true },
    orderBy: { createdAt: 'desc' },
    take: 300,
  });

  if (followUps.length < 10) return [];

  if (!process.env.GEMINI_API_KEY) return [];

  const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

  // Sample up to 100 questions for the analysis
  const sample = followUps.slice(0, 100).map(f => f.userQuestion);

  const prompt = `You are analyzing follow-up questions users asked AFTER receiving AI outfit feedback.
These questions reveal what the original feedback FAILED to address.

Follow-up questions (${sample.length} samples from the last 2 weeks):
${sample.map((q, i) => `${i + 1}. "${q}"`).join('\n')}

Identify the top 3-5 recurring TOPICS or GAPS that appear in these questions.
Each gap = something the AI feedback consistently missed.

Return JSON only (no markdown):
{
  "gaps": [
    "gap description as a weakness statement (e.g., 'Feedback doesn't address occasion-specific formality rules')",
    ...
  ]
}`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { temperature: 0.3, maxOutputTokens: 512 },
    });
    const result = await model.generateContent(prompt);
    const raw = result.response.text().trim().replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/i, '');
    const match = raw.match(/\{[\s\S]*\}/);
    if (!match) return [];

    const parsed = JSON.parse(match[0]) as { gaps?: string[] };
    const gaps = Array.isArray(parsed.gaps) ? parsed.gaps.filter(g => typeof g === 'string') : [];

    console.log(`[FollowUpMining] Discovered ${gaps.length} prompt gaps from ${followUps.length} follow-ups`);

    // Publish to Intelligence Bus
    if (gaps.length > 0) {
      publishToIntelligenceBus('followup-mining', 'followup_gaps', {
        discoveredAt: new Date().toISOString(),
        sampleSize: followUps.length,
        gaps,
      }).catch(() => {});
    }

    return gaps;
  } catch (err) {
    console.error('[FollowUpMining] Failed:', err);
    return [];
  }
}

// ─── A4: Aggregate comparison votes → DiscoveredRules ────────────────────────

/**
 * Aggregate community comparison votes into DiscoveredRules.
 * High decisiveness for an occasion = users have strong aesthetic opinions for it.
 * Also aggregates AI verdict accuracy when both AI verdict and outcome data exist.
 */
export async function discoverComparisonRules(): Promise<void> {
  const posts = await prisma.comparisonPost.findMany({
    where: { isDeleted: false },
    select: { occasions: true, votesA: true, votesB: true, question: true },
    orderBy: { createdAt: 'desc' },
    take: 500,
  });

  // Aggregate decisive votes by occasion (>= 65% margin = decisive)
  const byOccasion = new Map<string, { total: number; decisive: number }>();

  for (const post of posts) {
    const totalVotes = post.votesA + post.votesB;
    if (totalVotes < 5) continue;

    const maxVotes = Math.max(post.votesA, post.votesB);
    const decisiveMargin = maxVotes / totalVotes;

    for (const occasion of post.occasions) {
      const entry = byOccasion.get(occasion) || { total: 0, decisive: 0 };
      entry.total++;
      if (decisiveMargin >= 0.65) entry.decisive++;
      byOccasion.set(occasion, entry);
    }
  }

  let rulesCreated = 0;
  for (const [occasion, data] of byOccasion) {
    if (data.total < 5) continue;

    const decisiveRate = data.decisive / data.total;
    if (decisiveRate < 0.6) continue;

    const rule = `For "${occasion}", community comparisons show decisive preferences (${(decisiveRate * 100).toFixed(0)}% decisive rate, n=${data.total}). Users have strong aesthetic opinions for this context — give specific, opinionated advice rather than hedging.`;

    // Check if a similar rule exists
    const existing = await prisma.discoveredRule.findFirst({
      where: { category: 'occasion', rule: { contains: `For "${occasion}"` } },
    });

    if (!existing) {
      await prisma.discoveredRule.create({
        data: {
          category: 'occasion',
          rule,
          confidence: Math.min(data.total / 30, 1.0),
          sampleSize: data.total,
          evidence: `${data.decisive}/${data.total} decisive comparisons` as any,
        },
      });
      rulesCreated++;
    }
  }

  console.log(`[ComparisonRules] discoverComparisonRules: ${posts.length} posts analyzed, ${rulesCreated} new rules created`);
}

// ─── Step 2: DISCOVER — Extract new fashion rules from StyleDNA patterns ────

async function discoverFashionRules(): Promise<DiscoveredFashionRule[]> {
  const rules: DiscoveredFashionRule[] = [];

  // Get all StyleDNA records with their scores
  const dnas = await prisma.styleDNA.findMany({
    include: {
      outfitCheck: {
        select: { aiScore: true, communityAvgScore: true, communityScoreCount: true },
      },
    },
    orderBy: { createdAt: 'desc' },
    take: 1000,
  });

  if (dnas.length < 20) return rules; // Not enough data to discover patterns

  // --- Color combination analysis ---
  const colorPairScores = new Map<string, { scores: number[]; count: number }>();
  for (const dna of dnas) {
    const score = dna.outfitCheck.communityScoreCount >= 3
      ? dna.outfitCheck.communityAvgScore
      : dna.outfitCheck.aiScore;
    if (score === null) continue;

    const colors = dna.dominantColors.sort();
    for (let i = 0; i < colors.length; i++) {
      for (let j = i + 1; j < colors.length; j++) {
        const pair = `${colors[i]}+${colors[j]}`;
        const entry = colorPairScores.get(pair) || { scores: [], count: 0 };
        entry.scores.push(score);
        entry.count++;
        colorPairScores.set(pair, entry);
      }
    }
  }

  // Find high-performing color combos
  const avgScore = dnas
    .filter(d => d.outfitCheck.aiScore !== null)
    .reduce((sum, d) => sum + d.outfitCheck.aiScore!, 0) / dnas.filter(d => d.outfitCheck.aiScore !== null).length;

  for (const [pair, data] of colorPairScores) {
    if (data.count < 5) continue;
    const pairAvg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    if (pairAvg > avgScore + 0.8) {
      rules.push({
        category: 'color',
        rule: `The color combination ${pair.replace('+', ' + ')} consistently scores above average (${pairAvg.toFixed(1)} vs ${avgScore.toFixed(1)} overall avg)`,
        confidence: Math.min(data.count / 20, 1),
        sampleSize: data.count,
        evidence: `${data.count} outfits, avg score ${pairAvg.toFixed(1)}`,
      });
    }
    if (pairAvg < avgScore - 1.0) {
      rules.push({
        category: 'color',
        rule: `The color combination ${pair.replace('+', ' + ')} tends to underperform (${pairAvg.toFixed(1)} vs ${avgScore.toFixed(1)} overall avg) — suggest alternatives when detected`,
        confidence: Math.min(data.count / 20, 1),
        sampleSize: data.count,
        evidence: `${data.count} outfits, avg score ${pairAvg.toFixed(1)}`,
      });
    }
  }

  // --- Archetype + formality sweet spots ---
  const archetypeFormalityScores = new Map<string, { scores: number[]; count: number }>();
  for (const dna of dnas) {
    const score = dna.outfitCheck.aiScore;
    if (score === null || !dna.formalityLevel) continue;

    for (const archetype of dna.styleArchetypes) {
      const key = `${archetype}@formality${dna.formalityLevel}`;
      const entry = archetypeFormalityScores.get(key) || { scores: [], count: 0 };
      entry.scores.push(score);
      entry.count++;
      archetypeFormalityScores.set(key, entry);
    }
  }

  for (const [key, data] of archetypeFormalityScores) {
    if (data.count < 5) continue;
    const keyAvg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    const [archetype, formality] = key.split('@');
    if (keyAvg > avgScore + 1.0) {
      rules.push({
        category: 'archetype',
        rule: `${archetype} style at ${formality} is a strong combination (avg ${keyAvg.toFixed(1)}) — reinforce when detected`,
        confidence: Math.min(data.count / 15, 1),
        sampleSize: data.count,
        evidence: `${data.count} outfits, avg score ${keyAvg.toFixed(1)}`,
      });
    }
  }

  // --- Silhouette + garment patterns ---
  const silhouetteScores = new Map<string, { scores: number[]; count: number }>();
  for (const dna of dnas) {
    const score = dna.outfitCheck.aiScore;
    if (score === null || !dna.silhouetteType) continue;

    const entry = silhouetteScores.get(dna.silhouetteType) || { scores: [], count: 0 };
    entry.scores.push(score);
    entry.count++;
    silhouetteScores.set(dna.silhouetteType, entry);
  }

  for (const [silhouette, data] of silhouetteScores) {
    if (data.count < 10) continue;
    const silAvg = data.scores.reduce((a, b) => a + b, 0) / data.scores.length;
    if (Math.abs(silAvg - avgScore) > 0.5) {
      const direction = silAvg > avgScore ? 'outperforms' : 'underperforms';
      rules.push({
        category: 'proportion',
        rule: `${silhouette} silhouette ${direction} the average by ${Math.abs(silAvg - avgScore).toFixed(1)} points (${silAvg.toFixed(1)}) — adjust advice accordingly`,
        confidence: Math.min(data.count / 30, 1),
        sampleSize: data.count,
        evidence: `${data.count} outfits, avg score ${silAvg.toFixed(1)}`,
      });
    }
  }

  // --- Seasonal patterns ---
  const monthScores = new Map<number, { scores: number[]; count: number }>();
  for (const dna of dnas) {
    const score = dna.outfitCheck.aiScore;
    if (score === null) continue;
    const month = dna.createdAt.getMonth();
    const entry = monthScores.get(month) || { scores: [], count: 0 };
    entry.scores.push(score);
    entry.count++;
    monthScores.set(month, entry);
  }

  // Save newly discovered rules to the database
  const existingRules = await prisma.discoveredRule.findMany({
    select: { rule: true },
  });
  const existingRuleTexts = new Set(existingRules.map(r => r.rule));

  for (const rule of rules) {
    if (!existingRuleTexts.has(rule.rule) && rule.confidence >= 0.3) {
      await prisma.discoveredRule.create({
        data: {
          category: rule.category,
          rule: rule.rule,
          confidence: rule.confidence,
          sampleSize: rule.sampleSize,
          evidence: rule.evidence,
        },
      });
    }
  }

  return rules;
}

// ─── Step 3: DIAGNOSE — Identify weaknesses ─────────────────────────────────

async function diagnoseWeaknesses(): Promise<WeaknessReport> {
  const weaknesses: string[] = [];
  const lowPerformingOccasions: string[] = [];
  const calibrationIssues: string[] = [];
  const userComplaints: string[] = [];

  // Find occasions with consistently low scores
  const recentOutfits = await prisma.outfitCheck.findMany({
    where: {
      aiProcessedAt: { not: null },
      isDeleted: false,
      createdAt: { gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) },
    },
    select: {
      occasions: true,
      aiScore: true,
      feedbackRating: true,
      feedbackHelpful: true,
      communityAvgScore: true,
      communityScoreCount: true,
    },
  });

  // Occasion-level analysis
  const byOccasion = new Map<string, { aiScores: number[]; ratings: number[]; deltas: number[] }>();
  for (const outfit of recentOutfits) {
    for (const occasion of outfit.occasions) {
      const entry = byOccasion.get(occasion) || { aiScores: [], ratings: [], deltas: [] };
      if (outfit.aiScore !== null) entry.aiScores.push(outfit.aiScore);
      if (outfit.feedbackRating !== null) entry.ratings.push(outfit.feedbackRating);
      if (outfit.aiScore !== null && outfit.communityAvgScore !== null && outfit.communityScoreCount >= 3) {
        entry.deltas.push(outfit.aiScore - outfit.communityAvgScore);
      }
      byOccasion.set(occasion, entry);
    }
  }

  for (const [occasion, data] of byOccasion) {
    if (data.ratings.length >= 3) {
      const avgRating = data.ratings.reduce((a, b) => a + b, 0) / data.ratings.length;
      if (avgRating < 3.5) {
        lowPerformingOccasions.push(occasion);
        weaknesses.push(`"${occasion}" outfits have low user satisfaction (avg rating ${avgRating.toFixed(1)}/5, n=${data.ratings.length})`);
      }
    }
    if (data.deltas.length >= 3) {
      const avgDelta = data.deltas.reduce((a, b) => a + b, 0) / data.deltas.length;
      if (Math.abs(avgDelta) > 1.0) {
        const direction = avgDelta > 0 ? 'higher' : 'lower';
        calibrationIssues.push(`AI scores ${Math.abs(avgDelta).toFixed(1)} points ${direction} than community for "${occasion}" outfits`);
      }
    }
  }

  // Find patterns in unhelpful feedback
  const unhelpful = recentOutfits.filter(o => o.feedbackHelpful === false || (o.feedbackRating !== null && o.feedbackRating <= 2));
  if (unhelpful.length >= 5) {
    const unhelpfulPct = (unhelpful.length / recentOutfits.length * 100).toFixed(1);
    weaknesses.push(`${unhelpfulPct}% of recent feedback rated unhelpful or <= 2 stars (${unhelpful.length}/${recentOutfits.length})`);
  }

  // Check calibration trend from snapshots
  const snapshots = await prisma.calibrationSnapshot.findMany({
    orderBy: { createdAt: 'desc' },
    take: 4,
  });

  if (snapshots.length >= 2) {
    const latestDelta = snapshots[0].delta;
    const previousDelta = snapshots[1].delta;
    if (Math.abs(latestDelta) > Math.abs(previousDelta) + 0.3) {
      calibrationIssues.push(`Calibration drift increasing: delta went from ${previousDelta.toFixed(2)} to ${latestDelta.toFixed(2)}`);
    }
    if (snapshots[0].correlation !== null && snapshots[0].correlation < 0.5) {
      calibrationIssues.push(`Low AI-community correlation (r=${snapshots[0].correlation.toFixed(3)}) — AI opinions diverging from users`);
    }
  }

  return { weaknesses, lowPerformingOccasions, calibrationIssues, userComplaints };
}

// ─── Step 4: IMPROVE — Generate an improved prompt candidate ────────────────

async function generateImprovedPrompt(
  currentPrompt: string,
  weaknesses: WeaknessReport,
  discoveredRules: DiscoveredFashionRule[],
  metrics: PerformanceMetrics,
): Promise<string | null> {
  const unincorporatedRules = await prisma.discoveredRule.findMany({
    where: { incorporated: false, confidence: { gte: 0.5 } },
    orderBy: { confidence: 'desc' },
    take: 10,
  });

  const rulesSection = unincorporatedRules.length > 0
    ? `\n\nNEW FASHION RULES DISCOVERED FROM USER DATA (incorporate these):\n${unincorporatedRules.map((r, i) => `${i + 1}. [${r.category}] ${r.rule} (confidence: ${(r.confidence * 100).toFixed(0)}%, n=${r.sampleSize})`).join('\n')}`
    : '';

  const weaknessSection = [
    ...weaknesses.weaknesses,
    ...weaknesses.calibrationIssues,
  ].map((w, i) => `${i + 1}. ${w}`).join('\n');

  const metricsSection = `
Current performance:
- Sample size: ${metrics.sampleSize}
- Avg AI score given: ${metrics.avgAiScore?.toFixed(1) ?? 'N/A'}
- Avg user rating: ${metrics.avgUserRating?.toFixed(1) ?? 'N/A'}/5
- Avg |AI - community| delta: ${metrics.avgCommunityDelta?.toFixed(2) ?? 'N/A'} (lower is better)
- % marked helpful: ${metrics.helpfulPct !== null ? (metrics.helpfulPct * 100).toFixed(1) + '%' : 'N/A'}
- Fallback rate: ${(metrics.fallbackRate ?? 0) * 100}%`;

  const metaPrompt = `You are an expert AI prompt engineer specializing in fashion and personal styling applications.

Your task: Improve the system prompt for an AI outfit feedback engine. The improvement must be TARGETED — fix specific weaknesses while preserving what works.

CURRENT PERFORMANCE METRICS:
${metricsSection}

IDENTIFIED WEAKNESSES (fix these):
${weaknessSection || 'No major weaknesses identified — focus on incremental refinement.'}
${rulesSection}

LOW-PERFORMING OCCASIONS: ${weaknesses.lowPerformingOccasions.join(', ') || 'None identified'}

CALIBRATION ISSUES: ${weaknesses.calibrationIssues.join('; ') || 'None — AI and community are aligned'}

RULES FOR IMPROVEMENT:
1. Preserve the exact JSON output structure (overallScore, summary, whatsWorking, consider, quickFixes, occasionMatch, styleDNA)
2. Preserve the warm, supportive brand voice
3. Preserve all existing fashion knowledge that users already find helpful
4. ADD new knowledge sections for any discovered rules
5. STRENGTHEN guidance for low-performing occasions with more specific examples
6. ADJUST scoring calibration guidance if there are calibration issues
7. Keep the same section structure (PERSONALITY, FASHION KNOWLEDGE BASE, EXAMPLE ANALYSES, etc.)
8. Do NOT remove any sections — only improve, expand, or add

OUTPUT: Return ONLY the complete improved system prompt text. No preamble, no markdown fences, no explanation — just the prompt ready to use as-is.`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.4,
        maxOutputTokens: 16384,
      },
    });

    const result = await model.generateContent([
      metaPrompt,
      `\n\n=== CURRENT SYSTEM PROMPT ===\n\n${currentPrompt}`,
    ]);

    const improved = result.response.text().trim();

    // Basic validation — must contain key structural markers
    const requiredMarkers = ['PERSONALITY:', 'RESPONSE FORMAT:', 'overallScore', 'styleDNA'];
    const hasAllMarkers = requiredMarkers.every(marker => improved.includes(marker));

    if (!hasAllMarkers) {
      console.error('[RecursiveImprovement] Generated prompt missing required structural markers');
      return null;
    }

    // Must be at least 80% the length of the original (shouldn't shrink dramatically)
    if (improved.length < currentPrompt.length * 0.8) {
      console.error('[RecursiveImprovement] Generated prompt suspiciously short');
      return null;
    }

    return improved;
  } catch (error) {
    console.error('[RecursiveImprovement] Prompt generation failed:', error);
    return null;
  }
}

// ─── Step 5: A/B Test Setup ─────────────────────────────────────────────────

async function deployCandidate(
  improvedPrompt: string,
  parentVersion: string,
  cycleId: string,
): Promise<string> {
  // Generate version name
  const existing = await prisma.promptVersion.findMany({
    where: { parentVersion },
    orderBy: { createdAt: 'desc' },
    take: 1,
  });

  const suffix = existing.length > 0 ? `-${existing.length + 1}` : '';
  const newVersion = `${parentVersion}-auto${suffix}`;

  // Create the candidate prompt version
  await prisma.promptVersion.create({
    data: {
      version: newVersion,
      parentVersion,
      promptText: improvedPrompt,
      source: 'auto-optimize',
      trafficPct: 10, // Start with 10% traffic
      isActive: true,
      isCandidate: true,
    },
  });

  console.log(`[RecursiveImprovement] Deployed candidate ${newVersion} at 10% traffic`);
  return newVersion;
}

// ─── Step 6: Evaluate A/B results and promote/kill ──────────────────────────

export async function evaluateABTests(): Promise<void> {
  const candidates = await prisma.promptVersion.findMany({
    where: { isCandidate: true, isActive: true },
  });

  for (const candidate of candidates) {
    // Need at least 50 samples to make a decision
    if (candidate.sampleSize < 50) {
      console.log(`[RecursiveImprovement] Candidate ${candidate.version} has ${candidate.sampleSize} samples — waiting for more data`);
      continue;
    }

    // Find the parent (control) version
    const control = candidate.parentVersion
      ? await prisma.promptVersion.findUnique({ where: { version: candidate.parentVersion } })
      : null;

    if (!control || control.sampleSize < 50) {
      console.log(`[RecursiveImprovement] Control ${candidate.parentVersion} has insufficient data — waiting`);
      continue;
    }

    // Compare metrics — candidate must beat control on user rating
    const candidateRating = candidate.avgUserRating ?? 0;
    const controlRating = control.avgUserRating ?? 0;
    const candidateDelta = candidate.avgCommunityDelta ?? 10;
    const controlDelta = control.avgCommunityDelta ?? 10;

    const ratingImprovement = candidateRating - controlRating;
    const deltaImprovement = controlDelta - candidateDelta; // Lower delta is better

    console.log(`[RecursiveImprovement] A/B results for ${candidate.version}:`);
    console.log(`  Rating: ${candidateRating.toFixed(2)} vs ${controlRating.toFixed(2)} (${ratingImprovement > 0 ? '+' : ''}${ratingImprovement.toFixed(2)})`);
    console.log(`  Delta:  ${candidateDelta.toFixed(2)} vs ${controlDelta.toFixed(2)} (${deltaImprovement > 0 ? '+' : ''}${deltaImprovement.toFixed(2)})`);

    if (ratingImprovement > 0.1 || (ratingImprovement >= 0 && deltaImprovement > 0.2)) {
      // Candidate wins — promote it
      await promoteCandidate(candidate.version, control.version);
    } else if (ratingImprovement < -0.2) {
      // Candidate clearly worse — kill it
      await prisma.promptVersion.update({
        where: { id: candidate.id },
        data: { isActive: false, isCandidate: false, trafficPct: 0 },
      });
      console.log(`[RecursiveImprovement] Killed candidate ${candidate.version} — underperforming`);
    } else {
      // Inconclusive — increase traffic to get more signal
      const newTraffic = Math.min(candidate.trafficPct + 10, 40);
      await prisma.promptVersion.update({
        where: { id: candidate.id },
        data: { trafficPct: newTraffic },
      });
      console.log(`[RecursiveImprovement] Increased ${candidate.version} traffic to ${newTraffic}%`);
    }
  }
}

async function promoteCandidate(candidateVersion: string, controlVersion: string): Promise<void> {
  // Demote control
  await prisma.promptVersion.update({
    where: { version: controlVersion },
    data: { isActive: false, trafficPct: 0 },
  });

  // Promote candidate
  await prisma.promptVersion.update({
    where: { version: candidateVersion },
    data: {
      isCandidate: false,
      trafficPct: 100,
      promotedAt: new Date(),
    },
  });

  // Mark any discovered rules used in this version as incorporated
  await prisma.discoveredRule.updateMany({
    where: { incorporated: false },
    data: { incorporated: true, incorporatedIn: candidateVersion },
  });

  console.log(`[RecursiveImprovement] PROMOTED ${candidateVersion} to 100% traffic (replaced ${controlVersion})`);
}

// ─── Active prompt selection (called from ai-feedback.service) ──────────────

/**
 * Returns the system prompt to use for a given request.
 * Handles A/B testing by probabilistically selecting between active versions.
 */
/**
 * C2: Get the user's StyleDNA cohort key (top 2 archetypes, sorted + joined).
 * e.g. ["Classic", "Minimalist"] → "classic-minimalist"
 */
async function getUserCohort(userId: string): Promise<string | null> {
  try {
    const styleDNA = await prisma.styleDNA.findFirst({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: { styleArchetypes: true },
    });
    const archetypes = styleDNA?.styleArchetypes?.slice(0, 2) ?? [];
    if (archetypes.length === 0) return null;
    return archetypes.map(a => a.toLowerCase()).sort().join('-');
  } catch {
    return null;
  }
}

export async function getActivePrompt(userId?: string): Promise<{ prompt: string; version: string }> {
  try {
    // C2: If userId provided, check for cohort-specific active version first
    if (userId) {
      const cohort = await getUserCohort(userId);
      if (cohort) {
        const cohortVersion = await prisma.promptVersion.findFirst({
          where: { isActive: true, trafficPct: { gt: 0 }, cohort } as any,
          orderBy: { trafficPct: 'desc' },
        });
        if (cohortVersion) {
          return { prompt: cohortVersion.promptText, version: cohortVersion.version };
        }
      }
    }

    const activeVersions = await prisma.promptVersion.findMany({
      where: { isActive: true, trafficPct: { gt: 0 }, cohort: null },
      orderBy: { trafficPct: 'desc' },
    });

    if (activeVersions.length === 0) {
      // No versions in DB — use hardcoded default
      return { prompt: SYSTEM_PROMPT, version: PROMPT_VERSION };
    }

    // Weighted random selection based on traffic percentage
    const totalTraffic = activeVersions.reduce((sum, v) => sum + v.trafficPct, 0);
    const roll = Math.random() * totalTraffic;

    let cumulative = 0;
    for (const version of activeVersions) {
      cumulative += version.trafficPct;
      if (roll <= cumulative) {
        return { prompt: version.promptText, version: version.version };
      }
    }

    // Fallback to first active version
    return { prompt: activeVersions[0].promptText, version: activeVersions[0].version };
  } catch (error) {
    // If DB fails, use hardcoded default
    console.error('[RecursiveImprovement] Failed to fetch active prompt, using default:', error);
    return { prompt: SYSTEM_PROMPT, version: PROMPT_VERSION };
  }
}

/**
 * Update metrics for a prompt version after an analysis completes.
 * Called from ai-feedback.service after each successful analysis.
 */
export async function recordPromptResult(
  version: string,
  aiScore: number,
): Promise<void> {
  try {
    const pv = await prisma.promptVersion.findUnique({ where: { version } });
    if (!pv) return;

    const newSampleSize = pv.sampleSize + 1;
    const newAvgAiScore = pv.avgAiScore !== null
      ? (pv.avgAiScore * pv.sampleSize + aiScore) / newSampleSize
      : aiScore;

    await prisma.promptVersion.update({
      where: { version },
      data: {
        sampleSize: newSampleSize,
        avgAiScore: newAvgAiScore,
      },
    });
  } catch (error) {
    // Non-fatal — don't break analysis flow
    console.error('[RecursiveImprovement] Failed to record prompt result:', error);
  }
}

/**
 * Update user rating metrics for a prompt version.
 * Called when a user rates their feedback.
 */
export async function recordPromptRating(
  version: string,
  rating: number,
  helpful: boolean | null,
): Promise<void> {
  try {
    const pv = await prisma.promptVersion.findUnique({ where: { version } });
    if (!pv) return;

    // Incrementally update avg user rating
    const ratingCount = pv.avgUserRating !== null ? pv.sampleSize : 0;
    const newRatingCount = ratingCount + 1;
    const newAvgRating = pv.avgUserRating !== null
      ? (pv.avgUserRating * ratingCount + rating) / newRatingCount
      : rating;

    // Incrementally update helpful percentage
    let newHelpfulPct = pv.helpfulPct;
    if (helpful !== null) {
      const helpfulCount = pv.helpfulPct !== null ? Math.round(pv.helpfulPct * ratingCount) : 0;
      const newHelpfulTotal = helpfulCount + (helpful ? 1 : 0);
      newHelpfulPct = newHelpfulTotal / newRatingCount;
    }

    await prisma.promptVersion.update({
      where: { version },
      data: {
        avgUserRating: newAvgRating,
        helpfulPct: newHelpfulPct,
      },
    });
  } catch (error) {
    console.error('[RecursiveImprovement] Failed to record prompt rating:', error);
  }
}

// ─── Main orchestrator ──────────────────────────────────────────────────────

/**
 * Run a complete improvement cycle.
 * This is the recursive loop: measure -> discover -> diagnose -> improve -> deploy.
 */
export async function runImprovementCycle(trigger: string = 'scheduled'): Promise<void> {
  console.log(`[RecursiveImprovement] Starting improvement cycle (trigger: ${trigger})`);

  const cycle = await prisma.improvementCycle.create({
    data: { trigger, status: 'running' },
  });

  const log: string[] = [];

  try {
    // Step 1: Measure current performance
    log.push('--- STEP 1: MEASURE ---');
    const metrics = await measurePromptPerformance();
    log.push(`Sample size: ${metrics.sampleSize}`);
    log.push(`Avg user rating: ${metrics.avgUserRating?.toFixed(2) ?? 'N/A'}`);
    log.push(`Avg community delta: ${metrics.avgCommunityDelta?.toFixed(2) ?? 'N/A'}`);
    log.push(`Helpful %: ${metrics.helpfulPct !== null ? (metrics.helpfulPct * 100).toFixed(1) + '%' : 'N/A'}`);

    if (metrics.sampleSize < 20) {
      log.push('Not enough data for improvement cycle. Aborting.');
      await prisma.improvementCycle.update({
        where: { id: cycle.id },
        data: { status: 'completed', completedAt: new Date(), log: log.join('\n') },
      });
      return;
    }

    // Step 2: Discover new fashion rules
    log.push('\n--- STEP 2: DISCOVER ---');
    const discoveredRules = await discoverFashionRules();
    log.push(`Discovered ${discoveredRules.length} new fashion rules`);
    for (const rule of discoveredRules.slice(0, 5)) {
      log.push(`  [${rule.category}] ${rule.rule} (confidence: ${(rule.confidence * 100).toFixed(0)}%)`);
    }

    // A4: Aggregate comparison votes → DiscoveredRules
    await discoverComparisonRules().catch(err => log.push(`  comparison rules error: ${err}`));
    log.push('Comparison vote rules aggregated');

    // B1: Mine follow-up questions for prompt gaps
    const followUpGaps = await mineFollowUpGaps().catch(() => [] as string[]);
    if (followUpGaps.length > 0) {
      log.push(`Follow-up mining: ${followUpGaps.length} prompt gaps discovered`);
    }

    // Publish high-confidence discovered rules to Intelligence Bus
    for (const rule of discoveredRules.filter(r => r.confidence >= 0.7)) {
      publishToIntelligenceBus('recursive-improvement', 'discovered_knowledge', {
        category: rule.category,
        rule: rule.rule,
        confidence: rule.confidence,
        sampleSize: rule.sampleSize,
      }).catch(() => {});
    }

    // Step 3: Diagnose weaknesses (inject follow-up gaps as explicit weaknesses)
    log.push('\n--- STEP 3: DIAGNOSE ---');
    const weaknesses = await diagnoseWeaknesses();
    // Inject follow-up mining results as additional prompt weaknesses (B1)
    if (followUpGaps.length > 0) {
      weaknesses.weaknesses.push(...followUpGaps.map(g => `[Follow-up mining] ${g}`));
    }
    log.push(`Weaknesses: ${weaknesses.weaknesses.length}`);
    log.push(`Low-performing occasions: ${weaknesses.lowPerformingOccasions.join(', ') || 'none'}`);
    log.push(`Calibration issues: ${weaknesses.calibrationIssues.length}`);

    // Check if improvement is needed
    const needsImprovement =
      weaknesses.weaknesses.length > 0 ||
      weaknesses.calibrationIssues.length > 0 ||
      discoveredRules.filter(r => r.confidence >= 0.5).length > 0 ||
      (metrics.avgUserRating !== null && metrics.avgUserRating < 4.0);

    if (!needsImprovement) {
      log.push('\nNo significant weaknesses or new rules — skipping prompt generation.');
      await prisma.improvementCycle.update({
        where: { id: cycle.id },
        data: {
          status: 'completed',
          completedAt: new Date(),
          log: log.join('\n'),
          triggerMetrics: metrics as any,
          weaknessesFound: weaknesses as any,
          knowledgeExtracted: discoveredRules as any,
        },
      });
      return;
    }

    // Step 4: Generate improved prompt
    log.push('\n--- STEP 4: IMPROVE ---');

    // Get the current active prompt (may be from DB or hardcoded)
    const current = await getActivePrompt();
    log.push(`Current active prompt: ${current.version}`);

    const improvedPrompt = await generateImprovedPrompt(
      current.prompt,
      weaknesses,
      discoveredRules,
      metrics,
    );

    if (!improvedPrompt) {
      log.push('Failed to generate improved prompt. Aborting.');
      await prisma.improvementCycle.update({
        where: { id: cycle.id },
        data: { status: 'failed', completedAt: new Date(), log: log.join('\n') },
      });
      return;
    }

    log.push(`Generated improved prompt (${improvedPrompt.length} chars vs ${current.prompt.length} original)`);

    // Step 5: Deploy as A/B candidate
    log.push('\n--- STEP 5: DEPLOY ---');

    // Ensure current version exists in DB
    const existingCurrent = await prisma.promptVersion.findUnique({
      where: { version: current.version },
    });
    if (!existingCurrent) {
      await prisma.promptVersion.create({
        data: {
          version: current.version,
          promptText: current.prompt,
          source: 'manual',
          trafficPct: 90,
          isActive: true,
          isCandidate: false,
        },
      });
      log.push(`Registered current prompt ${current.version} in version table`);
    }

    const candidateVersion = await deployCandidate(improvedPrompt, current.version, cycle.id);
    log.push(`Deployed candidate: ${candidateVersion} at 10% traffic`);

    // Update cycle record
    await prisma.improvementCycle.update({
      where: { id: cycle.id },
      data: {
        status: 'completed',
        completedAt: new Date(),
        sourceVersion: current.version,
        candidateVersion,
        triggerMetrics: metrics as any,
        weaknessesFound: weaknesses as any,
        knowledgeExtracted: discoveredRules as any,
        log: log.join('\n'),
      },
    });

    console.log(`[RecursiveImprovement] Cycle complete. Candidate ${candidateVersion} deployed for A/B testing.`);
  } catch (error) {
    const errMsg = error instanceof Error ? error.message : String(error);
    log.push(`\nERROR: ${errMsg}`);
    await prisma.improvementCycle.update({
      where: { id: cycle.id },
      data: { status: 'failed', completedAt: new Date(), log: log.join('\n') },
    });
    console.error('[RecursiveImprovement] Cycle failed:', error);
  }
}

// ─── Quality-drop trigger ───────────────────────────────────────────────────

/**
 * C1+C2: StyleDNA Cohort Clustering — run a simplified improvement cycle per cohort.
 * Finds top 8 archetype cohorts by user count, runs improvement for each with 20+ users.
 * Creates cohort-tagged PromptVersion candidates for A/B testing.
 * Runs monthly (~10K tokens/run).
 */
export async function runCohortImprovementCycle(): Promise<void> {
  if (!process.env.GEMINI_API_KEY) {
    console.log('[CohortImprovement] Gemini not configured — skipping');
    return;
  }

  console.log('[CohortImprovement] Starting cohort improvement cycle...');

  // Step 1: Find top cohorts by user count (group by top 2 archetypes)
  const styleDNARecords = await prisma.styleDNA.findMany({
    orderBy: { createdAt: 'desc' },
    select: { userId: true, styleArchetypes: true },
    take: 2000,
  });

  // Deduplicate by userId (keep most recent)
  const latestByUser = new Map<string, string[]>();
  for (const r of styleDNARecords) {
    if (!latestByUser.has(r.userId)) {
      latestByUser.set(r.userId, r.styleArchetypes.slice(0, 2));
    }
  }

  // Build cohort counts
  const cohortCounts = new Map<string, number>();
  for (const [, archetypes] of latestByUser) {
    if (archetypes.length === 0) continue;
    const cohortKey = archetypes.map(a => a.toLowerCase()).sort().join('-');
    cohortCounts.set(cohortKey, (cohortCounts.get(cohortKey) || 0) + 1);
  }

  // Top 8 cohorts with 20+ users
  const topCohorts = [...cohortCounts.entries()]
    .filter(([, count]) => count >= 20)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8)
    .map(([cohort]) => cohort);

  if (topCohorts.length === 0) {
    console.log('[CohortImprovement] No cohorts with 20+ users — skipping');
    return;
  }

  console.log(`[CohortImprovement] Processing ${topCohorts.length} cohorts: ${topCohorts.join(', ')}`);

  // Get global active prompt as base
  const globalPrompt = await getActivePrompt();

  const genAI_local = new (await import('@google/generative-ai').then(m => m.GoogleGenerativeAI))(
    process.env.GEMINI_API_KEY
  );

  for (const cohortKey of topCohorts) {
    try {
      // Check if we already have a recent cohort version (within 14 days)
      const recentCohortVersion = await prisma.promptVersion.findFirst({
        where: {
          cohort: cohortKey,
          createdAt: { gte: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000) },
        },
      });
      if (recentCohortVersion) {
        console.log(`[CohortImprovement] Cohort ${cohortKey}: recent version exists — skipping`);
        continue;
      }

      // Get cohort-specific performance data
      const cohortUserIds = [...latestByUser.entries()]
        .filter(([, archetypes]) => archetypes.map(a => a.toLowerCase()).sort().join('-') === cohortKey)
        .map(([userId]) => userId);

      const cohortChecks = await prisma.outfitCheck.findMany({
        where: {
          userId: { in: cohortUserIds },
          isDeleted: false,
          aiScore: { not: null },
          feedbackRating: { not: null },
        },
        select: { aiScore: true, feedbackRating: true, occasions: true },
        take: 100,
        orderBy: { createdAt: 'desc' },
      });

      if (cohortChecks.length < 10) {
        console.log(`[CohortImprovement] Cohort ${cohortKey}: insufficient data (${cohortChecks.length}) — skipping`);
        continue;
      }

      const avgRating = cohortChecks.reduce((s, c) => s + (c.feedbackRating || 0), 0) / cohortChecks.length;
      const commonOccasions = cohortChecks
        .flatMap(c => c.occasions)
        .reduce((acc, o) => { acc.set(o, (acc.get(o) || 0) + 1); return acc; }, new Map<string, number>());
      const topOccasions = [...commonOccasions.entries()].sort((a, b) => b[1] - a[1]).slice(0, 3).map(([o]) => o);
      const archetypeLabel = cohortKey.split('-').map(a => a[0].toUpperCase() + a.slice(1)).join('+');

      const prompt = `You are improving an AI outfit analysis system's prompt for a specific user cohort.

Cohort: ${archetypeLabel} users (${cohortUserIds.length} users)
Their most common occasions: ${topOccasions.join(', ')}
Their avg satisfaction rating: ${avgRating.toFixed(2)}/5
Sample size: ${cohortChecks.length} outfit checks

Current global prompt (first 800 chars):
${globalPrompt.prompt.slice(0, 800)}

Generate a cohort-specific variant of the analysis instructions that:
1. Acknowledges the ${archetypeLabel} aesthetic sensibility
2. Applies occasion-specific advice relevant to ${topOccasions.slice(0, 2).join(' and ')}
3. Keeps the same JSON output format
4. Is only a 2-3 paragraph ADDITION to prepend to the existing prompt (not a full replacement)

Return the addition text only, no JSON wrapper, max 400 words.`;

      const model = genAI_local.getGenerativeModel({
        model: 'gemini-2.5-flash-lite',
        generationConfig: { temperature: 0.5, maxOutputTokens: 512 },
      });
      const result = await model.generateContent(prompt);
      const cohortAddition = result.response.text().trim();

      if (!cohortAddition || cohortAddition.length < 50) continue;

      const cohortPromptText = `COHORT CONTEXT (${archetypeLabel} aesthetic):\n${cohortAddition}\n\n${globalPrompt.prompt}`;
      const cohortVersionId = `${globalPrompt.version}-cohort-${cohortKey}-${Date.now()}`;

      await prisma.promptVersion.create({
        data: {
          version: cohortVersionId,
          parentVersion: globalPrompt.version,
          cohort: cohortKey,
          promptText: cohortPromptText,
          source: 'auto-optimize',
          trafficPct: 100, // Active for this cohort (only shown to matching users)
          isActive: true,
          isCandidate: false,
        } as any,
      });

      console.log(`[CohortImprovement] Created cohort variant for ${cohortKey} (${cohortUserIds.length} users)`);

      // Small delay to avoid rate limiting
      await new Promise(r => setTimeout(r, 2000));
    } catch (err) {
      console.error(`[CohortImprovement] Failed for cohort ${cohortKey}:`, err);
    }
  }

  console.log('[CohortImprovement] Cohort improvement cycle complete');
}

/**
 * Check if quality has dropped enough to trigger an improvement cycle.
 * Called from the scheduler on a regular basis.
 */
export async function checkAndTriggerImprovement(): Promise<void> {
  // Don't run if there's already an active candidate being tested
  const activeCandidates = await prisma.promptVersion.count({
    where: { isCandidate: true, isActive: true },
  });
  if (activeCandidates > 0) {
    // Instead, evaluate the running A/B test
    await evaluateABTests();
    return;
  }

  // Don't run if a cycle completed recently (within 7 days)
  const recentCycle = await prisma.improvementCycle.findFirst({
    where: { completedAt: { gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } },
    orderBy: { completedAt: 'desc' },
  });
  if (recentCycle) {
    console.log(`[RecursiveImprovement] Recent cycle found (${recentCycle.id}) — skipping`);
    return;
  }

  // Measure current performance
  const metrics = await measurePromptPerformance();

  // Trigger conditions
  const shouldTrigger =
    (metrics.avgUserRating !== null && metrics.avgUserRating < 3.5) ||
    (metrics.avgCommunityDelta !== null && metrics.avgCommunityDelta > 1.5) ||
    (metrics.helpfulPct !== null && metrics.helpfulPct < 0.6) ||
    (metrics.fallbackRate !== null && metrics.fallbackRate > 0.1);

  if (shouldTrigger) {
    console.log('[RecursiveImprovement] Quality drop detected — triggering improvement cycle');
    await runImprovementCycle('quality-drop');
  } else {
    // Even without quality issues, run a discovery-only cycle weekly to find new patterns
    const lastDiscovery = await prisma.improvementCycle.findFirst({
      orderBy: { startedAt: 'desc' },
    });
    const daysSinceLastCycle = lastDiscovery
      ? (Date.now() - lastDiscovery.startedAt.getTime()) / (24 * 60 * 60 * 1000)
      : Infinity;

    if (daysSinceLastCycle >= 7) {
      console.log('[RecursiveImprovement] Weekly scheduled cycle');
      await runImprovementCycle('scheduled');
    }
  }
}
