/**
 * STAGE 5: ANALYZE
 * Detect weakness patterns across all results
 */

import fs from 'fs';
import path from 'path';
import { QualityScores, CategorizedImage, WeaknessAnalysis, WeaknessPattern } from '../types.js';
import { Logger } from '../utils/logger.js';

export async function analyze(
  runId: string,
  dataDir: string,
  qualityScores: QualityScores[],
  images: CategorizedImage[],
  logger: Logger
): Promise<WeaknessAnalysis> {
  logger.stage(5, 'ANALYZE');

  const patterns: WeaknessPattern[] = [];

  // 1. Analyze by occasion
  const byOccasion = groupByOccasion(qualityScores, images);
  for (const [occasion, scores] of byOccasion.entries()) {
    const avgBrandVoice = scores.reduce((sum, s) => sum + s.brandVoiceScore, 0) / scores.length;
    const avgSpecificity = scores.reduce((sum, s) => sum + s.specificityScore, 0) / scores.length;

    if (avgBrandVoice < 90 || avgSpecificity < 85) {
      patterns.push({
        category: `occasion:${occasion}`,
        severity: avgBrandVoice < 80 ? 'high' : avgSpecificity < 80 ? 'high' : 'medium',
        affectedImages: scores.map(s => s.imageId),
        avgScore: (avgBrandVoice + avgSpecificity) / 2,
        examples: scores.slice(0, 3).flatMap(s => s.brandVoiceIssues.concat(s.specificityNotes)),
        suggestedFix: `Add more ${occasion}-specific examples to the prompt`,
      });
    }
  }

  // 2. Common brand voice violations
  const allBrandVoiceIssues = qualityScores.flatMap(s => s.brandVoiceIssues);
  const issueFrequency = new Map<string, number>();

  for (const issue of allBrandVoiceIssues) {
    issueFrequency.set(issue, (issueFrequency.get(issue) || 0) + 1);
  }

  const topIssues = [...issueFrequency.entries()]
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  for (const [issue, count] of topIssues) {
    if (count > qualityScores.length * 0.1) {
      // Affects >10% of responses
      patterns.push({
        category: 'brand-voice:prohibited-phrase',
        severity: count > qualityScores.length * 0.2 ? 'high' : 'medium',
        affectedImages: qualityScores.filter(s => s.brandVoiceIssues.includes(issue)).map(s => s.imageId),
        avgScore: 0,
        examples: [issue],
        suggestedFix: `Add explicit instruction to avoid: "${issue.replace('Contains prohibited phrase: "', '').replace('"', '')}"`,
      });
    }
  }

  // 3. Specificity gaps
  const lowSpecificity = qualityScores.filter(s => s.specificityScore < 85);
  if (lowSpecificity.length > qualityScores.length * 0.3) {
    patterns.push({
      category: 'specificity:vague-language',
      severity: 'high',
      affectedImages: lowSpecificity.map(s => s.imageId),
      avgScore: lowSpecificity.reduce((sum, s) => sum + s.specificityScore, 0) / lowSpecificity.length,
      examples: lowSpecificity.slice(0, 5).flatMap(s => s.specificityNotes),
      suggestedFix: 'Strengthen prompt to require specific fashion terms and concrete color names',
    });
  }

  // 4. Actionability issues
  const lowActionability = qualityScores.filter(s => s.actionabilityScore < 80);
  if (lowActionability.length > qualityScores.length * 0.3) {
    patterns.push({
      category: 'actionability:vague-suggestions',
      severity: 'medium',
      affectedImages: lowActionability.map(s => s.imageId),
      avgScore: lowActionability.reduce((sum, s) => sum + s.actionabilityScore, 0) / lowActionability.length,
      examples: lowActionability.slice(0, 5).flatMap(s => s.actionabilityNotes),
      suggestedFix: 'Add examples of concrete quick fixes (e.g., "add a gold chain necklace" not "try accessories")',
    });
  }

  // 5. Score calibration
  const avgAiScore = qualityScores.reduce((sum, s) => sum + s.aiScore, 0) / qualityScores.length;
  if (avgAiScore > 8.5) {
    patterns.push({
      category: 'calibration:scores-too-high',
      severity: 'low',
      affectedImages: [],
      avgScore: avgAiScore,
      examples: [`Average AI score is ${avgAiScore.toFixed(1)}/10`],
      suggestedFix: 'Scores may be inflated - consider recalibrating to use full 1-10 range',
    });
  } else if (avgAiScore < 6.0) {
    patterns.push({
      category: 'calibration:scores-too-low',
      severity: 'low',
      affectedImages: [],
      avgScore: avgAiScore,
      examples: [`Average AI score is ${avgAiScore.toFixed(1)}/10`],
      suggestedFix: 'Scores may be too harsh - ensure feedback is encouraging while constructive',
    });
  }

  // Sort by severity and score
  const topWeaknesses = patterns
    .sort((a, b) => {
      const severityOrder = { high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity] || a.avgScore - b.avgScore;
    })
    .slice(0, 5);

  // Generate recommendations
  const recommendations = generateRecommendations(topWeaknesses, qualityScores);

  const analysis: WeaknessAnalysis = {
    patterns,
    topWeaknesses,
    recommendations,
  };

  // Save analysis
  const analysisFile = path.join(dataDir, 'evaluations', runId, 'weakness-analysis.json');
  fs.writeFileSync(analysisFile, JSON.stringify(analysis, null, 2));

  logger.success(`Identified ${patterns.length} weakness patterns`);
  logger.metric('Top weaknesses', topWeaknesses.length);

  return analysis;
}

function groupByOccasion(
  scores: QualityScores[],
  images: CategorizedImage[]
): Map<string, QualityScores[]> {
  const byOccasion = new Map<string, QualityScores[]>();

  for (const score of scores) {
    const image = images.find(img => img.id === score.imageId);
    if (!image) continue;

    for (const occasion of image.occasion) {
      const existing = byOccasion.get(occasion) || [];
      existing.push(score);
      byOccasion.set(occasion, existing);
    }
  }

  return byOccasion;
}

function generateRecommendations(
  topWeaknesses: WeaknessPattern[],
  qualityScores: QualityScores[]
): string[] {
  const recommendations: string[] = [];

  for (const weakness of topWeaknesses) {
    recommendations.push(`${weakness.severity.toUpperCase()}: ${weakness.suggestedFix}`);
  }

  // General recommendations based on aggregate scores
  const avgBrandVoice = qualityScores.reduce((sum, s) => sum + s.brandVoiceScore, 0) / qualityScores.length;
  const avgSpecificity = qualityScores.reduce((sum, s) => sum + s.specificityScore, 0) / qualityScores.length;
  const avgActionability = qualityScores.reduce((sum, s) => sum + s.actionabilityScore, 0) / qualityScores.length;

  if (avgBrandVoice < 95) {
    recommendations.push('Review brand voice validator rules and update prompt examples');
  }

  if (avgSpecificity < 90) {
    recommendations.push('Add fashion knowledge base section with more specific terminology');
  }

  if (avgActionability < 85) {
    recommendations.push('Include more concrete quick fix examples in prompt');
  }

  if (recommendations.length === 0) {
    recommendations.push('Quality scores are meeting targets - no immediate action needed');
    recommendations.push('Consider running again after prompt deployment to verify improvements');
  }

  return recommendations;
}
