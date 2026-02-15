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
  summary: string; // One-sentence enthusiastic summary
  whatsWorking: string[]; // 2-3 specific positives
  consider: string[]; // 1-2 gentle suggestions (only if score < 9)
  quickFixes: string[]; // 3-4 actionable tips
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
 * Opening phrases based on score range
 */
export const OPENING_PHRASES = {
  exceptional: [ // 9-10
    'Absolutely stunning!',
    'You\'re nailing it!',
    'This is perfection!',
    'Magazine-worthy!',
    'Chef\'s kiss! 💋',
    'You\'ve absolutely got this!',
  ],
  great: [ // 7-8.9
    'Looking gorgeous!',
    'You\'re on the right track!',
    'Love this!',
    'Great choice!',
    'This works beautifully!',
    'So close to perfection!',
  ],
  good: [ // 5-6.9
    'Great foundation!',
    'You\'ve got good instincts!',
    'Nice pieces here!',
    'Strong start!',
    'Love your creativity!',
  ],
  needsWork: [ // < 5
    'You\'ve got some great pieces!',
    'I see what you\'re going for!',
    'Let\'s elevate this!',
    'Good bones—let\'s polish it!',
  ],
};

/**
 * Closing phrases to boost confidence
 */
export const CLOSING_PHRASES = {
  noChanges: [
    'Walk out with confidence—you\'ve got this! ✨',
    'You\'re ready to turn heads! 🔥',
    'Trust your instincts—you nailed it!',
    'Absolutely ready to go!',
  ],
  minorTweaks: [
    'With these small tweaks, you\'ll be unstoppable! 💫',
    'These quick changes will take it from great to perfect!',
    'You\'re 95% there—these final touches will seal the deal!',
    'Almost there—these adjustments will make all the difference!',
  ],
  majorChanges: [
    'With these changes, you\'re going to look amazing!',
    'These swaps will transform the look!',
    'You\'re going to love how this turns out!',
    'Can\'t wait to see the updated version!',
  ],
};

/**
 * Transition phrases for constructive feedback
 */
export const TRANSITION_PHRASES = {
  toSuggestions: [
    'To take this from great to perfect:',
    'Here\'s how to elevate it even more:',
    'Want to dial it up? Try this:',
    'For an even stronger look:',
    'To make this truly show-stopping:',
  ],
  toQuickFixes: [
    'Quick styling tips:',
    'Finishing touches:',
    'To complete the look:',
    'Final details to nail it:',
    'Polish it with:',
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

  // Check that whatsWorking has more items than consider (positive focus)
  if (template.consider.length > 0 && template.whatsWorking.length <= template.consider.length) {
    errors.push('Should have more "what\'s working" points than "consider" points (stay positive!)');
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

  md += `## What's Working ✨\n\n`;
  feedback.whatsWorking.forEach(point => {
    md += `- ${point}\n`;
  });

  if (feedback.consider.length > 0) {
    md += `\n## Consider 💭\n\n`;
    feedback.consider.forEach(point => {
      md += `- ${point}\n`;
    });
  }

  md += `\n## Quick Fixes 🔧\n\n`;
  feedback.quickFixes.forEach(tip => {
    md += `- ${tip}\n`;
  });

  return md;
}
