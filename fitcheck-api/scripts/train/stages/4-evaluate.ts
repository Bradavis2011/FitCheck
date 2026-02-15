/**
 * STAGE 4: EVALUATE
 * Score each AI response for brand voice, specificity, actionability
 */

import fs from 'fs';
import path from 'path';
import { AIResponse, QualityScores, ConsistencyScores } from '../types.js';
import { brandVoiceValidator } from '../../../src/validators/brand-voice-validator.js';
import { Logger } from '../utils/logger.js';

export async function evaluate(
  runId: string,
  dataDir: string,
  responses: AIResponse[],
  logger: Logger
): Promise<{ qualityScores: QualityScores[]; consistencyScores: ConsistencyScores[] }> {
  logger.stage(4, 'EVALUATE');

  const evaluationsDir = path.join(dataDir, 'evaluations', runId);
  fs.mkdirSync(evaluationsDir, { recursive: true });

  const qualityScores: QualityScores[] = [];

  // Evaluate each response
  for (const response of responses) {
    if (response.error || !response.response) {
      continue; // Skip failed responses
    }

    logger.progress(qualityScores.length + 1, responses.length, response.imageId);

    const scores = evaluateResponse(response);
    qualityScores.push(scores);

    // Save individual evaluation
    fs.writeFileSync(
      path.join(evaluationsDir, `${response.imageId}-run${response.runNumber}.json`),
      JSON.stringify(scores, null, 2)
    );
  }

  // Calculate consistency scores (compare run 1 vs run 2)
  const consistencyScores = calculateConsistency(responses, logger);

  // Save aggregate stats
  const aggregateStats = calculateAggregateStats(qualityScores, consistencyScores);
  fs.writeFileSync(
    path.join(evaluationsDir, 'aggregate-stats.json'),
    JSON.stringify(aggregateStats, null, 2)
  );

  logger.success(`Evaluated ${qualityScores.length} responses`);
  logger.metric('Avg Brand Voice', `${aggregateStats.avgBrandVoice.toFixed(1)}/100`);
  logger.metric('Avg Specificity', `${aggregateStats.avgSpecificity.toFixed(1)}/100`);
  logger.metric('Avg Actionability', `${aggregateStats.avgActionability.toFixed(1)}/100`);
  logger.metric('Avg Consistency Var', aggregateStats.avgConsistencyVar.toFixed(2));

  return { qualityScores, consistencyScores };
}

function evaluateResponse(response: AIResponse): QualityScores {
  const feedback = response.response;

  // 1. Brand Voice Score
  const fullText = [
    feedback.summary,
    ...feedback.whatsWorking.map((w: any) => `${w.point} ${w.detail}`),
    ...feedback.consider.map((c: any) => `${c.point} ${c.detail}`),
    ...feedback.quickFixes.map((q: any) => `${q.suggestion} ${q.impact}`),
    feedback.occasionMatch.notes,
  ].join(' ');

  const brandVoiceValidation = brandVoiceValidator.validate(fullText);
  const brandVoiceScore = brandVoiceValidation.score;
  const brandVoiceIssues = brandVoiceValidation.issues.map(i => i.message);

  // 2. Specificity Score
  const specificityResult = evaluateSpecificity(feedback);

  // 3. Actionability Score
  const actionabilityResult = evaluateActionability(feedback);

  // 4. Schema Compliance
  const schemaResult = evaluateSchemaCompliance(feedback);

  return {
    imageId: response.imageId,
    runNumber: response.runNumber,
    brandVoiceScore,
    brandVoiceIssues,
    specificityScore: specificityResult.score,
    specificityNotes: specificityResult.notes,
    actionabilityScore: actionabilityResult.score,
    actionabilityNotes: actionabilityResult.notes,
    schemaComplianceScore: schemaResult.score,
    schemaIssues: schemaResult.issues,
    aiScore: feedback.overallScore || 0,
  };
}

function evaluateSpecificity(feedback: any): { score: number; notes: string[] } {
  let score = 100;
  const notes: string[] = [];

  // Check for specific fashion terms
  const fashionTerms = [
    'silhouette', 'proportion', 'color', 'fit', 'waist', 'hem', 'neckline',
    'sleeve', 'fabric', 'texture', 'pattern', 'complementary', 'analogous',
    'monochromatic', 'rule of thirds', 'layering',
  ];

  const fullText = JSON.stringify(feedback).toLowerCase();
  const termsUsed = fashionTerms.filter(term => fullText.includes(term));

  if (termsUsed.length < 3) {
    score -= 30;
    notes.push(`Only ${termsUsed.length} fashion-specific terms used (target: 3+)`);
  }

  // Check for vague language
  const vaguePatterns = [
    /\blooks? good\b/i,
    /\blooks? nice\b/i,
    /\bit'?s? okay\b/i,
    /\bpretty good\b/i,
  ];

  const vagueCount = vaguePatterns.filter(pattern => pattern.test(fullText)).length;
  if (vagueCount > 0) {
    score -= vagueCount * 15;
    notes.push(`${vagueCount} vague phrase(s) detected`);
  }

  // Check for specific colors mentioned
  const colorPattern = /\b(navy|crimson|burgundy|olive|coral|teal|charcoal|cream|sage|rust|blush|emerald|cobalt)\b/i;
  if (!colorPattern.test(fullText)) {
    score -= 10;
    notes.push('No specific color names (e.g., "navy" instead of just "blue")');
  }

  return { score: Math.max(0, score), notes };
}

function evaluateActionability(feedback: any): { score: number; notes: string[] } {
  let score = 100;
  const notes: string[] = [];

  const quickFixes = feedback.quickFixes || [];

  if (quickFixes.length === 0) {
    score -= 50;
    notes.push('No quick fixes provided');
  } else {
    // Check if fixes are concrete
    for (const fix of quickFixes) {
      const suggestion = fix.suggestion?.toLowerCase() || '';

      // Vague suggestions
      if (
        suggestion.includes('try accessories') ||
        suggestion.includes('add something') ||
        suggestion.includes('consider')
      ) {
        score -= 15;
        notes.push(`Vague suggestion: "${fix.suggestion}"`);
      }

      // Good actionable patterns
      if (
        suggestion.includes('add a ') ||
        suggestion.includes('roll ') ||
        suggestion.includes('cuff ') ||
        suggestion.includes('tuck ') ||
        suggestion.includes('belt')
      ) {
        // Bonus for concrete actions
        score += 5;
      }
    }
  }

  return { score: Math.max(0, Math.min(100, score)), notes };
}

function evaluateSchemaCompliance(feedback: any): { score: number; issues: string[] } {
  let score = 100;
  const issues: string[] = [];

  // Required fields
  if (typeof feedback.overallScore !== 'number' || feedback.overallScore < 1 || feedback.overallScore > 10) {
    score -= 30;
    issues.push('Invalid overallScore (must be 1-10)');
  }

  if (!feedback.summary || typeof feedback.summary !== 'string') {
    score -= 20;
    issues.push('Missing or invalid summary');
  }

  if (!Array.isArray(feedback.whatsWorking) || feedback.whatsWorking.length === 0) {
    score -= 15;
    issues.push('Missing whatsWorking array');
  }

  if (!Array.isArray(feedback.consider) || feedback.consider.length === 0) {
    score -= 15;
    issues.push('Missing consider array');
  }

  if (!Array.isArray(feedback.quickFixes)) {
    score -= 10;
    issues.push('Missing quickFixes array');
  }

  if (!feedback.occasionMatch || typeof feedback.occasionMatch.score !== 'number') {
    score -= 10;
    issues.push('Invalid occasionMatch');
  }

  return { score: Math.max(0, score), issues };
}

function calculateConsistency(responses: AIResponse[], logger: Logger): ConsistencyScores[] {
  const consistency: ConsistencyScores[] = [];

  // Group by imageId
  const byImage = new Map<string, AIResponse[]>();
  for (const response of responses) {
    if (!response.error && response.response) {
      const existing = byImage.get(response.imageId) || [];
      existing.push(response);
      byImage.set(response.imageId, existing);
    }
  }

  for (const [imageId, runs] of byImage.entries()) {
    if (runs.length !== 2) continue;

    const [run1, run2] = runs;
    const score1 = run1.response.overallScore;
    const score2 = run2.response.overallScore;
    const scoreDiff = Math.abs(score1 - score2);

    // Calculate theme overlap (how similar are the points mentioned)
    const themes1 = extractThemes(run1.response);
    const themes2 = extractThemes(run2.response);
    const overlap = calculateOverlap(themes1, themes2);

    const consistent = scoreDiff < 0.5 && overlap > 0.7;

    consistency.push({
      imageId,
      scoreDifference: scoreDiff,
      themeOverlapPercent: overlap,
      consistent,
    });
  }

  return consistency;
}

function extractThemes(feedback: any): string[] {
  const themes: string[] = [];

  feedback.whatsWorking?.forEach((w: any) => themes.push(w.point?.toLowerCase() || ''));
  feedback.consider?.forEach((c: any) => themes.push(c.point?.toLowerCase() || ''));

  return themes.filter(t => t.length > 0);
}

function calculateOverlap(themes1: string[], themes2: string[]): number {
  if (themes1.length === 0 || themes2.length === 0) return 0;

  const set1 = new Set(themes1);
  const set2 = new Set(themes2);

  const intersection = [...set1].filter(t => set2.has(t)).length;
  const union = new Set([...set1, ...set2]).size;

  return intersection / union;
}

function calculateAggregateStats(
  qualityScores: QualityScores[],
  consistencyScores: ConsistencyScores[]
) {
  const n = qualityScores.length;

  return {
    totalResponses: n,
    avgBrandVoice: qualityScores.reduce((sum, s) => sum + s.brandVoiceScore, 0) / n,
    avgSpecificity: qualityScores.reduce((sum, s) => sum + s.specificityScore, 0) / n,
    avgActionability: qualityScores.reduce((sum, s) => sum + s.actionabilityScore, 0) / n,
    avgSchemaCompliance: qualityScores.reduce((sum, s) => sum + s.schemaComplianceScore, 0) / n,
    avgConsistencyVar: consistencyScores.reduce((sum, s) => sum + s.scoreDifference, 0) / consistencyScores.length,
    consistentCount: consistencyScores.filter(s => s.consistent).length,
    consistencyRate: consistencyScores.filter(s => s.consistent).length / consistencyScores.length,
  };
}
