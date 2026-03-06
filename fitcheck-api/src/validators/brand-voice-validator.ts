/**
 * Brand Voice Validator
 *
 * Ensures AI responses match the Or This? brand voice v3.0:
 * - Decisive, Direct, Confident, Discerning
 * - SoHo stylist who charges $400/hour — not a supportive friend
 * - The score IS the verdict. Delivered without apology or cushioning.
 */

export interface BrandVoiceValidation {
  isValid: boolean;
  score: number; // 0-100
  issues: BrandVoiceIssue[];
  suggestions: string[];
}

export interface BrandVoiceIssue {
  type: 'prohibited_phrase' | 'empty_validation' | 'lack_of_specificity' | 'too_hedging' | 'negative_tone';
  severity: 'critical' | 'warning' | 'minor';
  message: string;
  suggestion?: string;
}

// Phrases that violate Or This? brand voice v3.0
const PROHIBITED_PHRASES = [
  // Empty validation — positivity without specificity
  { phrase: 'you\'ve got this', severity: 'critical' as const },
  { phrase: 'chef\'s kiss', severity: 'critical' as const },
  { phrase: 'nailed it', severity: 'critical' as const },
  { phrase: 'trust your instincts', severity: 'critical' as const },
  { phrase: 'trust your', severity: 'warning' as const },
  { phrase: 'gorgeous', severity: 'warning' as const },
  { phrase: 'stunning', severity: 'warning' as const },
  { phrase: 'almost there', severity: 'warning' as const },
  { phrase: 'you look amazing', severity: 'critical' as const },
  { phrase: 'you look great', severity: 'warning' as const },
  { phrase: 'cute!!!', severity: 'critical' as const },

  // Undermining confidence / hedging decisions
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

  // Overly clinical/cold without direction
  { phrase: 'suboptimal', severity: 'warning' as const },
  { phrase: 'adequate', severity: 'warning' as const },
];

// Phrases that indicate good brand voice v3.0 — specific, declarative, editorial
const ENCOURAGED_PHRASES = [
  'proportions carry',
  'clean choice',
  'strong color story',
  'not there yet',
  'the silhouette',
  'simplify by',
  'reads sharper',
  'the layering',
  'both work',
  'the hem',
  'color story',
  'the proportions',
  'a look that',
  'the occasion',
  'carrying this',
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
   * Validates feedback text against Or This? brand voice guidelines v3.0
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

    // Check for editorial/specific language
    const lackOfSpecificity = this.checkSpecificity(feedback);
    if (lackOfSpecificity) {
      issues.push(lackOfSpecificity);
      score -= 10;
    }

    // Check for empty validation (no encouraged phrases)
    const emptyValidation = this.checkEmptyValidation(feedback);
    if (emptyValidation) {
      issues.push(emptyValidation);
      score -= 15;
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
            ? 'Replace with specific editorial observation — name the garment, the proportion, the color relationship'
            : 'Be more specific and declarative',
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
        suggestion: 'State the verdict. "The proportions compete" not "might want to consider the proportions"',
      });
    }

    return issues;
  }

  private checkEmptyValidation(text: string): BrandVoiceIssue | null {
    const lowerText = text.toLowerCase();
    const hasEditorialLanguage = ENCOURAGED_PHRASES.some(phrase =>
      lowerText.includes(phrase)
    );

    if (!hasEditorialLanguage) {
      return {
        type: 'empty_validation',
        severity: 'warning',
        message: 'Lacks specific editorial observations',
        suggestion: 'Name the specific element: "The proportions carry this." "Strong color story." "The layering is competing."',
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
      'neckline', 'sleeve', 'fabric', 'texture', 'pattern', 'layering',
    ];

    const lowerText = text.toLowerCase();
    const hasSpecificTerms = specificTerms.some(term => lowerText.includes(term));

    if (hasVague && !hasSpecificTerms) {
      return {
        type: 'lack_of_specificity',
        severity: 'minor',
        message: 'Feedback could be more specific',
        suggestion: 'Instead of "looks good", say WHY: "the A-line silhouette is doing the work here" or "the color story is clean"',
      };
    }

    return null;
  }

  private generateSuggestions(issues: BrandVoiceIssue[]): string[] {
    const suggestions: string[] = [];

    if (issues.some(i => i.type === 'prohibited_phrase')) {
      suggestions.push('Remove empty validation phrases. Replace with editorial observation: name the garment, the proportion, the color relationship.');
    }

    if (issues.some(i => i.type === 'too_hedging')) {
      suggestions.push('Deliver the verdict. "The proportions compete — simplify by one piece." Not "you might want to consider."');
    }

    if (issues.some(i => i.type === 'empty_validation')) {
      suggestions.push('Lead with what IS: "Strong color story." "The proportions carry this." "Not there yet." Specific. Declarative. Brief.');
    }

    if (issues.some(i => i.type === 'lack_of_specificity')) {
      suggestions.push('Be specific — explain WHY something works or doesn\'t (silhouette, color, proportions, the specific garment)');
    }

    // General v3.0 reminder
    if (issues.length > 0) {
      suggestions.push('Brand voice v3.0: Decisive. Direct. Confident. Discerning. SoHo stylist, not a supportive friend.');
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
