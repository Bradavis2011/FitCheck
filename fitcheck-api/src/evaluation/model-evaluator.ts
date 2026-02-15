/**
 * Model Evaluator
 *
 * Tools to test and evaluate AI model quality before launch.
 * Measures consistency, brand voice adherence, and accuracy.
 */

import { brandVoiceValidator, BrandVoiceValidation } from '../validators/brand-voice-validator.js';
import { FeedbackTemplate, validateFeedbackTemplate } from '../templates/feedback-template.js';

export interface EvaluationMetrics {
  // Consistency: same input → similar output
  consistency: {
    scoreVariance: number; // Std deviation of scores (target: < 0.5)
    averageScore: number;
    runs: number;
  };

  // Brand voice alignment
  brandVoice: {
    averageScore: number; // 0-100 (target: > 90)
    passRate: number; // % of responses that pass validation
    commonIssues: string[]; // Most frequent issues
  };

  // Quality metrics
  quality: {
    specificityScore: number; // % feedback with specific details (target: > 90%)
    actionabilityScore: number; // % feedback with actionable tips (target: > 95%)
    positivityRatio: number; // Ratio of positive to negative feedback (target: > 2)
  };

  // Template compliance
  templateCompliance: {
    validResponses: number;
    invalidResponses: number;
    commonErrors: string[];
  };
}

export interface TestCase {
  id: string;
  description: string;
  context: any;
  expectedScoreRange?: { min: number; max: number };
  expertScore?: number; // Ground truth from manual curation
}

export interface ConsistencyTestResult {
  testCase: TestCase;
  runs: FeedbackTemplate[];
  scoreVariance: number;
  averageScore: number;
  passed: boolean; // variance < 0.5
}

export interface BrandVoiceTestResult {
  feedback: string;
  validation: BrandVoiceValidation;
  passed: boolean;
}

export class ModelEvaluator {
  private results: {
    consistency: ConsistencyTestResult[];
    brandVoice: BrandVoiceTestResult[];
    templateValidation: any[];
  } = {
    consistency: [],
    brandVoice: [],
    templateValidation: [],
  };

  /**
   * Test consistency: run same input multiple times, check score variance
   */
  async evaluateConsistency(
    testCase: TestCase,
    generateFeedback: (context: any) => Promise<FeedbackTemplate>,
    runs: number = 5
  ): Promise<ConsistencyTestResult> {
    const feedbacks: FeedbackTemplate[] = [];

    // Run the same input multiple times
    for (let i = 0; i < runs; i++) {
      const feedback = await generateFeedback(testCase.context);
      feedbacks.push(feedback);
    }

    // Calculate score variance
    const scores = feedbacks.map(f => f.overallScore);
    const average = scores.reduce((sum, s) => sum + s, 0) / scores.length;
    const variance = Math.sqrt(
      scores.reduce((sum, s) => sum + Math.pow(s - average, 2), 0) / scores.length
    );

    const result: ConsistencyTestResult = {
      testCase,
      runs: feedbacks,
      scoreVariance: variance,
      averageScore: average,
      passed: variance < 0.5, // Target: < 0.5 points variance
    };

    this.results.consistency.push(result);
    return result;
  }

  /**
   * Test brand voice: validate response against brand guidelines
   */
  evaluateBrandVoice(feedback: string): BrandVoiceTestResult {
    const validation = brandVoiceValidator.validate(feedback);
    const result: BrandVoiceTestResult = {
      feedback,
      validation,
      passed: validation.isValid,
    };

    this.results.brandVoice.push(result);
    return result;
  }

  /**
   * Batch evaluate brand voice across multiple responses
   */
  batchEvaluateBrandVoice(feedbacks: string[]): {
    passRate: number;
    averageScore: number;
    results: BrandVoiceTestResult[];
    commonIssues: Map<string, number>;
  } {
    const results = feedbacks.map(f => this.evaluateBrandVoice(f));
    const passed = results.filter(r => r.passed).length;
    const passRate = (passed / results.length) * 100;
    const averageScore = results.reduce((sum, r) => sum + r.validation.score, 0) / results.length;

    // Count common issues
    const issueCount = new Map<string, number>();
    results.forEach(r => {
      r.validation.issues.forEach(issue => {
        const current = issueCount.get(issue.type) || 0;
        issueCount.set(issue.type, current + 1);
      });
    });

    return {
      passRate,
      averageScore,
      results,
      commonIssues: issueCount,
    };
  }

  /**
   * Evaluate template compliance
   */
  evaluateTemplateCompliance(feedback: FeedbackTemplate): {
    isValid: boolean;
    errors: string[];
  } {
    const validation = validateFeedbackTemplate(feedback);
    this.results.templateValidation.push({
      feedback,
      validation,
    });
    return validation;
  }

  /**
   * Compare AI score to expert-curated score
   */
  compareToExpertScore(aiScore: number, expertScore: number): {
    difference: number;
    accuracyScore: number; // 0-100
    passed: boolean; // within 1 point
  } {
    const difference = Math.abs(aiScore - expertScore);
    const accuracyScore = Math.max(0, 100 - (difference * 20)); // 0.5 diff = 90 score

    return {
      difference,
      accuracyScore,
      passed: difference <= 1.0, // Within 1 point is acceptable
    };
  }

  /**
   * Check specificity: does feedback include specific details?
   */
  checkSpecificity(feedback: FeedbackTemplate): {
    score: number; // 0-100
    hasSpecificTerms: boolean;
    vaguePhrases: string[];
  } {
    const allText = [
      feedback.summary,
      ...feedback.whatsWorking,
      ...feedback.consider,
      ...feedback.quickFixes,
    ].join(' ').toLowerCase();

    // Specific terms that indicate detailed feedback
    const specificTerms = [
      'silhouette', 'proportion', 'fit', 'waist', 'hem', 'neckline',
      'sleeve', 'fabric', 'texture', 'pattern', 'color', 'shade',
      'drape', 'length', 'ankle', 'shoulder', 'midi', 'maxi',
    ];

    const hasSpecific = specificTerms.some(term => allText.includes(term));

    // Vague phrases to avoid
    const vaguePhrases = [
      'looks good', 'looks nice', 'looks fine', 'it\'s okay',
      'works well', 'seems fine', 'pretty good',
    ];

    const foundVague = vaguePhrases.filter(phrase => allText.includes(phrase));

    // Score: 100 if has specific terms and no vague, 0 if only vague
    let score = hasSpecific ? 100 : 0;
    score -= foundVague.length * 20;
    score = Math.max(0, Math.min(100, score));

    return {
      score,
      hasSpecificTerms: hasSpecific,
      vaguePhrases: foundVague,
    };
  }

  /**
   * Check actionability: are tips concrete and actionable?
   */
  checkActionability(feedback: FeedbackTemplate): {
    score: number; // 0-100
    actionableTips: number;
    vagueTips: number;
  } {
    const tips = [...feedback.consider, ...feedback.quickFixes];

    // Actionable tips have concrete verbs
    const actionVerbs = [
      'add', 'swap', 'try', 'wear', 'pair', 'choose', 'go with',
      'remove', 'replace', 'bring', 'carry', 'opt for', 'switch',
    ];

    const actionableTips = tips.filter(tip => {
      const lowerTip = tip.toLowerCase();
      return actionVerbs.some(verb => lowerTip.includes(verb));
    }).length;

    const vagueTips = tips.length - actionableTips;
    const score = (actionableTips / tips.length) * 100;

    return {
      score,
      actionableTips,
      vagueTips,
    };
  }

  /**
   * Generate comprehensive evaluation report
   */
  generateReport(): EvaluationMetrics {
    // Consistency metrics
    const consistencyResults = this.results.consistency;
    const avgVariance = consistencyResults.length > 0
      ? consistencyResults.reduce((sum, r) => sum + r.scoreVariance, 0) / consistencyResults.length
      : 0;
    const avgScore = consistencyResults.length > 0
      ? consistencyResults.reduce((sum, r) => sum + r.averageScore, 0) / consistencyResults.length
      : 0;

    // Brand voice metrics
    const brandVoiceResults = this.results.brandVoice;
    const brandVoicePassRate = brandVoiceResults.length > 0
      ? (brandVoiceResults.filter(r => r.passed).length / brandVoiceResults.length) * 100
      : 0;
    const brandVoiceAvgScore = brandVoiceResults.length > 0
      ? brandVoiceResults.reduce((sum, r) => sum + r.validation.score, 0) / brandVoiceResults.length
      : 0;

    // Common issues
    const issueCount = new Map<string, number>();
    brandVoiceResults.forEach(r => {
      r.validation.issues.forEach(issue => {
        const current = issueCount.get(issue.message) || 0;
        issueCount.set(issue.message, current + 1);
      });
    });
    const commonIssues = Array.from(issueCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([issue]) => issue);

    // Template compliance
    const templateResults = this.results.templateValidation;
    const validResponses = templateResults.filter(r => r.validation.isValid).length;
    const invalidResponses = templateResults.length - validResponses;
    const errorCount = new Map<string, number>();
    templateResults.forEach(r => {
      r.validation.errors.forEach((error: string) => {
        const current = errorCount.get(error) || 0;
        errorCount.set(error, current + 1);
      });
    });
    const commonErrors = Array.from(errorCount.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, 5)
      .map(([error]) => error);

    return {
      consistency: {
        scoreVariance: avgVariance,
        averageScore: avgScore,
        runs: consistencyResults.reduce((sum, r) => sum + r.runs.length, 0),
      },
      brandVoice: {
        averageScore: brandVoiceAvgScore,
        passRate: brandVoicePassRate,
        commonIssues,
      },
      quality: {
        specificityScore: 0, // Calculated separately per feedback
        actionabilityScore: 0, // Calculated separately per feedback
        positivityRatio: 0, // Calculated separately per feedback
      },
      templateCompliance: {
        validResponses,
        invalidResponses,
        commonErrors,
      },
    };
  }

  /**
   * Reset all stored results
   */
  reset(): void {
    this.results = {
      consistency: [],
      brandVoice: [],
      templateValidation: [],
    };
  }

  /**
   * Print report to console
   */
  printReport(): void {
    const report = this.generateReport();

    console.log('\n📊 MODEL EVALUATION REPORT\n');

    console.log('🎯 CONSISTENCY');
    console.log(`  Score Variance: ${report.consistency.scoreVariance.toFixed(3)} (target: < 0.5)`);
    console.log(`  Average Score: ${report.consistency.averageScore.toFixed(2)}`);
    console.log(`  Total Runs: ${report.consistency.runs}`);
    console.log(`  Status: ${report.consistency.scoreVariance < 0.5 ? '✅ PASS' : '❌ FAIL'}\n`);

    console.log('🗣️  BRAND VOICE');
    console.log(`  Average Score: ${report.brandVoice.averageScore.toFixed(1)}/100 (target: > 90)`);
    console.log(`  Pass Rate: ${report.brandVoice.passRate.toFixed(1)}% (target: > 95%)`);
    console.log(`  Status: ${report.brandVoice.passRate >= 95 ? '✅ PASS' : '❌ FAIL'}`);
    if (report.brandVoice.commonIssues.length > 0) {
      console.log(`  Common Issues:`);
      report.brandVoice.commonIssues.forEach(issue => console.log(`    - ${issue}`));
    }
    console.log();

    console.log('📋 TEMPLATE COMPLIANCE');
    console.log(`  Valid: ${report.templateCompliance.validResponses}`);
    console.log(`  Invalid: ${report.templateCompliance.invalidResponses}`);
    if (report.templateCompliance.commonErrors.length > 0) {
      console.log(`  Common Errors:`);
      report.templateCompliance.commonErrors.forEach(error => console.log(`    - ${error}`));
    }
    console.log();
  }
}

// Export singleton instance
export const modelEvaluator = new ModelEvaluator();
