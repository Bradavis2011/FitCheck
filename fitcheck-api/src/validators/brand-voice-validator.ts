/**
 * Brand Voice Validator
 *
 * Ensures AI responses match the Or This? brand voice:
 * - Decisive, Warm, Confident, Real
 * - Avoids judgmental or negative language
 * - Maintains supportive and encouraging tone
 */

export interface BrandVoiceValidation {
  isValid: boolean;
  score: number; // 0-100
  issues: BrandVoiceIssue[];
  suggestions: string[];
}

export interface BrandVoiceIssue {
  type: 'prohibited_phrase' | 'negative_tone' | 'lack_of_specificity' | 'missing_encouragement' | 'too_hedging';
  severity: 'critical' | 'warning' | 'minor';
  message: string;
  suggestion?: string;
}

// Phrases that violate Or This? brand voice
const PROHIBITED_PHRASES = [
  // Judgmental
  { phrase: 'not flattering', severity: 'critical' as const },
  { phrase: 'unflattering', severity: 'critical' as const },
  { phrase: 'wrong', severity: 'critical' as const },
  { phrase: 'bad choice', severity: 'critical' as const },
  { phrase: 'mistake', severity: 'critical' as const },
  { phrase: 'doesn\'t work', severity: 'warning' as const },
  { phrase: 'won\'t work', severity: 'warning' as const },

  // Undermining confidence
  { phrase: 'should probably change', severity: 'critical' as const },
  { phrase: 'you should change', severity: 'critical' as const },
  { phrase: 'are you sure', severity: 'critical' as const },
  { phrase: 'not sure about', severity: 'warning' as const },
  { phrase: 'questionable', severity: 'warning' as const },

  // Body-focused (comment on clothes, not bodies)
  { phrase: 'hides problem areas', severity: 'critical' as const },
  { phrase: 'minimize', severity: 'warning' as const },
  { phrase: 'conceal', severity: 'warning' as const },
  { phrase: 'cover up', severity: 'warning' as const },

  // Overly clinical/cold
  { phrase: 'suboptimal', severity: 'warning' as const },
  { phrase: 'adequate', severity: 'warning' as const },
  { phrase: 'acceptable', severity: 'minor' as const },
];

// Phrases that indicate good brand voice
const ENCOURAGED_PHRASES = [
  'you\'ve got this',
  'gorgeous',
  'stunning',
  'beautiful',
  'love',
  'perfect',
  'nailed it',
  'confident',
  'trust your',
  'chef\'s kiss',
  'game changer',
  'show-stopping',
  'absolutely',
  'exactly right',
];

// Hedging words (decisive voice avoids these)
const HEDGING_WORDS = [
  'maybe',
  'perhaps',
  'possibly',
  'might want to',
  'could consider',
  'you could',
  'sort of',
  'kind of',
  'somewhat',
];

export class BrandVoiceValidator {
  /**
   * Validates feedback text against Or This? brand voice guidelines
   */
  validate(feedback: string): BrandVoiceValidation {
    const issues: BrandVoiceIssue[] = [];
    let score = 100;

    // Check for prohibited phrases
    const prohibitedFound = this.checkProhibitedPhrases(feedback);
    issues.push(...prohibitedFound);
    score -= prohibitedFound.reduce((sum, issue) => {
      return sum + (issue.severity === 'critical' ? 30 : issue.severity === 'warning' ? 15 : 5);
    }, 0);

    // Check for excessive hedging
    const hedgingIssues = this.checkHedging(feedback);
    issues.push(...hedgingIssues);
    score -= hedgingIssues.length * 10;

    // Check for encouraging language
    const lackOfEncouragement = this.checkEncouragement(feedback);
    if (lackOfEncouragement) {
      issues.push(lackOfEncouragement);
      score -= 15;
    }

    // Check for specificity
    const specificityIssue = this.checkSpecificity(feedback);
    if (specificityIssue) {
      issues.push(specificityIssue);
      score -= 10;
    }

    // Check tone/sentiment
    const toneIssue = this.checkTone(feedback);
    if (toneIssue) {
      issues.push(toneIssue);
      score -= 20;
    }

    score = Math.max(0, Math.min(100, score));

    const suggestions = this.generateSuggestions(issues);

    return {
      isValid: score >= 70 && !issues.some(i => i.severity === 'critical'),
      score,
      issues,
      suggestions,
    };
  }

  private checkProhibitedPhrases(text: string): BrandVoiceIssue[] {
    const issues: BrandVoiceIssue[] = [];
    const lowerText = text.toLowerCase();

    for (const { phrase, severity } of PROHIBITED_PHRASES) {
      if (lowerText.includes(phrase)) {
        issues.push({
          type: 'prohibited_phrase',
          severity,
          message: `Contains prohibited phrase: "${phrase}"`,
          suggestion: severity === 'critical'
            ? 'Remove this phrase and reframe constructively'
            : 'Consider more positive phrasing',
        });
      }
    }

    return issues;
  }

  private checkHedging(text: string): BrandVoiceIssue[] {
    const issues: BrandVoiceIssue[] = [];
    let hedgeCount = 0;

    for (const word of HEDGING_WORDS) {
      const regex = new RegExp(`\\b${word}\\b`, 'gi');
      const matches = text.match(regex);
      if (matches) {
        hedgeCount += matches.length;
      }
    }

    // More than 2 hedging words = lacks decisiveness
    if (hedgeCount > 2) {
      issues.push({
        type: 'too_hedging',
        severity: 'warning',
        message: `Too many hedging words (${hedgeCount} found)`,
        suggestion: 'Be more decisive—state recommendations clearly and confidently',
      });
    }

    return issues;
  }

  private checkEncouragement(text: string): BrandVoiceIssue | null {
    const lowerText = text.toLowerCase();
    const hasEncouragement = ENCOURAGED_PHRASES.some(phrase =>
      lowerText.includes(phrase)
    );

    if (!hasEncouragement) {
      return {
        type: 'missing_encouragement',
        severity: 'warning',
        message: 'Lacks encouraging/supportive language',
        suggestion: 'Add warm, supportive phrases like "you\'ve got this!", "gorgeous", or "stunning"',
      };
    }

    return null;
  }

  private checkSpecificity(text: string): BrandVoiceIssue | null {
    // Check for vague phrases that lack specificity
    const vaguePatterns = [
      /\blooks? good\b/i,
      /\blooks? nice\b/i,
      /\blooks? fine\b/i,
      /\bit'?s? okay\b/i,
    ];

    const hasVague = vaguePatterns.some(pattern => pattern.test(text));

    // Good feedback should have specific details (colors, silhouettes, proportions)
    const specificTerms = [
      'silhouette', 'proportion', 'color', 'fit', 'waist', 'hem',
      'neckline', 'sleeve', 'fabric', 'texture', 'pattern',
    ];

    const lowerText = text.toLowerCase();
    const hasSpecificTerms = specificTerms.some(term => lowerText.includes(term));

    if (hasVague && !hasSpecificTerms) {
      return {
        type: 'lack_of_specificity',
        severity: 'minor',
        message: 'Feedback could be more specific',
        suggestion: 'Instead of "looks good", say WHY it looks good (e.g., "the A-line silhouette balances your proportions perfectly")',
      };
    }

    return null;
  }

  private checkTone(text: string): BrandVoiceIssue | null {
    // Simple sentiment check: count positive vs. negative words
    const positiveWords = [
      'beautiful', 'gorgeous', 'stunning', 'perfect', 'great', 'excellent',
      'love', 'amazing', 'fantastic', 'wonderful', 'fabulous', 'chic',
      'elegant', 'polished', 'flattering', 'confident',
    ];

    const negativeWords = [
      'avoid', 'problem', 'issue', 'concern', 'wrong', 'bad',
      'poor', 'terrible', 'awful', 'harsh', 'unflattering',
    ];

    const positiveCount = positiveWords.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}`, 'gi');
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);

    const negativeCount = negativeWords.reduce((count, word) => {
      const regex = new RegExp(`\\b${word}`, 'gi');
      const matches = text.match(regex);
      return count + (matches ? matches.length : 0);
    }, 0);

    // Ratio should be at least 2:1 positive:negative
    if (negativeCount > 0 && positiveCount / negativeCount < 2) {
      return {
        type: 'negative_tone',
        severity: 'warning',
        message: `Tone may be too negative (${positiveCount} positive vs ${negativeCount} negative words)`,
        suggestion: 'Lead with positives and frame suggestions constructively. Always more "what\'s working" than "consider".',
      };
    }

    return null;
  }

  private generateSuggestions(issues: BrandVoiceIssue[]): string[] {
    const suggestions: string[] = [];

    if (issues.some(i => i.type === 'prohibited_phrase')) {
      suggestions.push('Remove judgmental phrases and reframe feedback constructively');
    }

    if (issues.some(i => i.type === 'too_hedging')) {
      suggestions.push('Be more decisive—replace "maybe" and "you could" with clear recommendations');
    }

    if (issues.some(i => i.type === 'missing_encouragement')) {
      suggestions.push('Add warm, supportive language: "You\'ve got this!", "Gorgeous!", "Stunning!"');
    }

    if (issues.some(i => i.type === 'lack_of_specificity')) {
      suggestions.push('Be specific—explain WHY something works (silhouette, color, proportions)');
    }

    if (issues.some(i => i.type === 'negative_tone')) {
      suggestions.push('Lead with positives. The "what\'s working" section should be longer than "consider"');
    }

    // General suggestions
    if (issues.length > 0) {
      suggestions.push('Remember: Decisive, Warm, Confident, Real');
    }

    return suggestions;
  }

  /**
   * Quick validation for testing - returns just pass/fail
   */
  quickValidate(feedback: string): boolean {
    const result = this.validate(feedback);
    return result.isValid;
  }

  /**
   * Get validation score (0-100)
   */
  getScore(feedback: string): number {
    const result = this.validate(feedback);
    return result.score;
  }
}

// Export singleton instance
export const brandVoiceValidator = new BrandVoiceValidator();
