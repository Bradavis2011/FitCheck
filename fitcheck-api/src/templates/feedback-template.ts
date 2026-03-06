/**
 * Feedback Response Templates
 *
 * Structured templates for AI feedback to ensure consistency
 * and enforce brand voice across all responses.
 */

export interface FeedbackTemplate {
  overallScore: number;
  criteriaScores: {
    fit: number;
    color: number;
    occasion: number;
    cohesion: number;
    confidence: number;
  };
  summary: string; // One declarative sentence — the verdict. No exclamation marks.
  whatsWorking: string[]; // 2-3 specific observations naming the garment/element and WHY
  consider: string[]; // 1-2 direct, specific edits (only if score < 9)
  quickFixes: string[]; // 3-4 actionable, specific tips naming the item
}

export interface ComparisonFeedbackTemplate {
  recommendation: 'option1' | 'option2';
  reasoning: string; // 2-3 sentences explaining why
  option1: FeedbackTemplate;
  option2: FeedbackTemplate;
}

export interface FollowUpResponse {
  answer: string;
  relatedTips?: string[];
}

/**
 * Opening phrases based on score range — v3.0 voice
 * Declarative. Specific. No empty validation.
 */
export const OPENING_PHRASES = {
  exceptional: [ // 9-10
    'The silhouette is doing all the work.',
    'Strong color story. This is intentional.',
    'Clean choice. The proportions are right.',
    'This reads exactly as it should.',
  ],
  great: [ // 7-8.9
    'Solid foundation. One edit away.',
    'The pieces are working. One thing to sharpen.',
    'Strong start. The color story holds.',
    'This is close. One specific fix.',
  ],
  good: [ // 5-6.9
    'The bones are here. The edit is clear.',
    'Right direction. Competing elements to resolve.',
    'Strong individual pieces. The cohesion needs work.',
    'Not there yet — the fix is specific.',
  ],
  needsWork: [ // < 5
    'The pieces exist. The brief isn\'t being met.',
    'This needs a deliberate redirect for the occasion.',
    'Not there yet. The edit is significant.',
    'The occasion needs more than this is delivering.',
  ],
};

/**
 * Closing phrases — v3.0 voice
 * Declarative. No empty encouragement.
 */
export const CLOSING_PHRASES = {
  noChanges: [
    'This is ready.',
    'The verdict holds.',
    'Nothing to add.',
    'Walk out.',
  ],
  minorTweaks: [
    'One edit. Then it\'s ready.',
    'These adjustments complete it.',
    'Make the change — then it\'s done.',
    'The fix is specific. Straightforward.',
  ],
  majorChanges: [
    'These swaps shift the read significantly.',
    'Address these and the outfit works.',
    'The brief changes with these edits.',
    'This is the redirect the occasion needs.',
  ],
};

/**
 * Transition phrases — v3.0 voice
 */
export const TRANSITION_PHRASES = {
  toSuggestions: [
    'The one edit:',
    'What would sharpen this:',
    'For the occasion:',
    'The specific fix:',
    'What it needs:',
  ],
  toQuickFixes: [
    'Specific edits:',
    'To complete it:',
    'The finishing details:',
    'Actionable changes:',
    'What to adjust:',
  ],
};

/**
 * Score-based phrase selectors
 */
export function getOpeningPhrase(score: number): string {
  const phrases = score >= 9 ? OPENING_PHRASES.exceptional
    : score >= 7 ? OPENING_PHRASES.great
    : score >= 5 ? OPENING_PHRASES.good
    : OPENING_PHRASES.needsWork;

  return phrases[Math.floor(Math.random() * phrases.length)];
}

export function getClosingPhrase(considerCount: number): string {
  const phrases = considerCount === 0 ? CLOSING_PHRASES.noChanges
    : considerCount <= 1 ? CLOSING_PHRASES.minorTweaks
    : CLOSING_PHRASES.majorChanges;

  return phrases[Math.floor(Math.random() * phrases.length)];
}

/**
 * Template validators
 */
export function validateFeedbackTemplate(template: FeedbackTemplate): {
  isValid: boolean;
  errors: string[];
} {
  const errors: string[] = [];

  // Check score ranges
  if (template.overallScore < 0 || template.overallScore > 10) {
    errors.push('Overall score must be between 0 and 10');
  }

  Object.entries(template.criteriaScores).forEach(([criterion, score]) => {
    if (score < 0 || score > 10) {
      errors.push(`${criterion} score must be between 0 and 10`);
    }
  });

  // Check required fields
  if (!template.summary || template.summary.trim().length === 0) {
    errors.push('Summary is required');
  }

  if (!template.whatsWorking || template.whatsWorking.length < 2) {
    errors.push('At least 2 "what\'s working" points required');
  }

  if (template.whatsWorking.length > 4) {
    errors.push('Maximum 4 "what\'s working" points (keep it focused)');
  }

  // Validate consider section based on score
  if (template.overallScore >= 9 && template.consider.length > 0) {
    errors.push('Scores 9+ should have minimal or no "consider" items');
  }

  if (template.overallScore < 6 && template.consider.length === 0) {
    errors.push('Scores below 6 should have actionable suggestions');
  }

  if (template.consider.length > 3) {
    errors.push('Maximum 3 "consider" items (don\'t overwhelm)');
  }

  // Quick fixes should always be present
  if (!template.quickFixes || template.quickFixes.length < 2) {
    errors.push('At least 2 quick fixes required');
  }

  if (template.quickFixes.length > 5) {
    errors.push('Maximum 5 quick fixes (keep it actionable)');
  }

  // Check that whatsWorking has more items than consider (specific observations over edits)
  if (template.consider.length > 0 && template.whatsWorking.length <= template.consider.length) {
    errors.push('Should have more "what\'s working" observations than "consider" edits');
  }

  return {
    isValid: errors.length === 0,
    errors,
  };
}

/**
 * Calculate overall score from criteria scores
 */
export function calculateOverallScore(criteriaScores: FeedbackTemplate['criteriaScores']): number {
  const scores = Object.values(criteriaScores);
  const average = scores.reduce((sum, score) => sum + score, 0) / scores.length;
  return Math.round(average * 10) / 10; // Round to 1 decimal
}

/**
 * Helper to format feedback as markdown (for display)
 */
export function formatFeedbackAsMarkdown(feedback: FeedbackTemplate): string {
  let md = `# Score: ${feedback.overallScore}/10\n\n`;
  md += `${feedback.summary}\n\n`;

  md += `## What's Working\n\n`;
  feedback.whatsWorking.forEach(point => {
    md += `- ${point}\n`;
  });

  if (feedback.consider.length > 0) {
    md += `\n## Consider\n\n`;
    feedback.consider.forEach(point => {
      md += `- ${point}\n`;
    });
  }

  md += `\n## Quick Fixes\n\n`;
  feedback.quickFixes.forEach(tip => {
    md += `- ${tip}\n`;
  });

  return md;
}
