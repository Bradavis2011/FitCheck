/**
 * STAGE 7: REPORT
 * Generate comprehensive training report
 */

import fs from 'fs';
import path from 'path';
import {
  TrainingReport,
  QualityScores,
  ConsistencyScores,
  WeaknessAnalysis,
  OptimizationResult,
  CategorizedImage,
} from '../types.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';

export async function report(
  runId: string,
  dataDir: string,
  images: CategorizedImage[],
  qualityScores: QualityScores[],
  consistencyScores: ConsistencyScores[],
  weaknessAnalysis: WeaknessAnalysis,
  optimizationResult: OptimizationResult | null,
  logger: Logger
): Promise<void> {
  logger.stage(7, 'REPORT');

  // Calculate aggregate stats
  const n = qualityScores.length;
  const avgBrandVoice = qualityScores.reduce((sum, s) => sum + s.brandVoiceScore, 0) / n;
  const avgSpecificity = qualityScores.reduce((sum, s) => sum + s.specificityScore, 0) / n;
  const avgActionability = qualityScores.reduce((sum, s) => sum + s.actionabilityScore, 0) / n;
  const avgConsistency = consistencyScores.reduce((sum, s) => sum + s.scoreDifference, 0) / consistencyScores.length;
  const schemaCompliance = (qualityScores.filter(s => s.schemaComplianceScore === 100).length / n) * 100;

  // Count images by source
  const imagesBySource = images.reduce((acc, img) => {
    acc[img.source] = (acc[img.source] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  const trainingReport: TrainingReport = {
    runId,
    timestamp: new Date().toISOString(),
    totalImages: images.length,
    imagesBySource,
    avgBrandVoice,
    avgSpecificity,
    avgActionability,
    avgConsistency,
    schemaCompliance,
    weaknesses: weaknessAnalysis,
    optimization: optimizationResult || undefined,
    recommendations: weaknessAnalysis.recommendations,
  };

  // Save JSON report
  const reportFile = path.join(dataDir, 'reports', runId, 'report.json');
  fs.mkdirSync(path.dirname(reportFile), { recursive: true });
  fs.writeFileSync(reportFile, JSON.stringify(trainingReport, null, 2));

  // Generate human-readable text report
  const textReport = generateTextReport(trainingReport);
  const textFile = path.join(dataDir, 'reports', runId, 'report.txt');
  fs.writeFileSync(textFile, textReport);

  // Print to console
  logger.header('TRAINING REPORT');
  console.log(textReport);

  logger.success(`Report saved to ${reportFile}`);
}

function generateTextReport(report: TrainingReport): string {
  const lines: string[] = [];

  lines.push('═══════════════════════════════════════════');
  lines.push('   Or This? AI Training Report');
  lines.push(`   Run: ${report.timestamp}`);
  lines.push('═══════════════════════════════════════════');
  lines.push('');

  // Images tested
  lines.push(`IMAGES TESTED: ${report.totalImages}`);
  for (const [source, count] of Object.entries(report.imagesBySource)) {
    lines.push(`  - ${source}: ${count}`);
  }
  lines.push('');

  // Quality scores
  lines.push('QUALITY SCORES (averages):');
  lines.push(`  Brand Voice:    ${report.avgBrandVoice.toFixed(0)}/100  ${getStatusIcon(report.avgBrandVoice, config.targetBrandVoice)}`);
  lines.push(`  Specificity:    ${report.avgSpecificity.toFixed(0)}/100  ${getStatusIcon(report.avgSpecificity, config.targetSpecificity)}`);
  lines.push(`  Actionability:  ${report.avgActionability.toFixed(0)}/100  ${getStatusIcon(report.avgActionability, config.targetActionability)}`);
  lines.push(`  Consistency:    ${report.avgConsistency.toFixed(2)} var ${getStatusIcon(config.targetConsistencyVar - report.avgConsistency, 0)}`);
  lines.push(`  Schema:         ${report.schemaCompliance.toFixed(0)}%    ${getStatusIcon(report.schemaCompliance, 100)}`);
  lines.push('');

  // Top weaknesses
  if (report.weaknesses.topWeaknesses.length > 0) {
    lines.push('TOP WEAKNESSES:');
    report.weaknesses.topWeaknesses.forEach((w, i) => {
      lines.push(`  ${i + 1}. [${w.severity.toUpperCase()}] ${w.category}`);
      lines.push(`     ${w.suggestedFix}`);
      if (w.examples.length > 0) {
        lines.push(`     Example: ${w.examples[0]}`);
      }
    });
    lines.push('');
  }

  // Optimization results
  if (report.optimization) {
    lines.push('OPTIMIZATION RESULTS:');
    lines.push(`  Candidate prompt generated: YES`);
    lines.push(`  Average improvement: ${report.optimization.avgImprovement > 0 ? '+' : ''}${report.optimization.avgImprovement.toFixed(1)} points`);
    lines.push(`  Success: ${report.optimization.successful ? 'YES ✅' : 'NO ❌'}`);
    lines.push('');
    lines.push(`  → Review candidate at: scripts/train/data/results/${report.runId}/optimized-prompt.txt`);
    lines.push('');
  }

  // Recommendations
  if (report.recommendations.length > 0) {
    lines.push('RECOMMENDATIONS:');
    report.recommendations.forEach((rec, i) => {
      lines.push(`  ${i + 1}. ${rec}`);
    });
  }

  lines.push('═══════════════════════════════════════════');

  return lines.join('\n');
}

function getStatusIcon(actual: number, target: number): string {
  if (actual >= target) return '✅';
  if (actual >= target * 0.9) return '⚠️';
  return '❌';
}
