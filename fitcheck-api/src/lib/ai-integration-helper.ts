/**
 * AI Integration Helper
 *
 * Helper functions to integrate all AI training components
 * with your actual AI service (OpenAI, Google Gemini, etc.)
 */

import { OUTFIT_ANALYSIS_SYSTEM_PROMPT, COMPARISON_PROMPT_SUFFIX, FOLLOW_UP_PROMPT } from '../prompts/outfit-analysis.prompt.js';
import { FEW_SHOT_EXAMPLES, EXAMPLES_BY_OCCASION } from '../data/few-shot-examples.js';
import { brandVoiceValidator } from '../validators/brand-voice-validator.js';
import { validateFeedbackTemplate, FeedbackTemplate } from '../templates/feedback-template.js';
import { COLOR_THEORY, FIT_GUIDELINES, QUICK_FIX_DATABASE } from '../knowledge/style-rules.js';

export interface OutfitContext {
  occasion?: string;
  weather?: string;
  setting?: string;
  vibe?: string;
  concerns?: string[];
}

/**
 * Build enhanced system prompt with few-shot examples
 */
export function buildEnhancedSystemPrompt(context?: OutfitContext): string {
  let prompt = OUTFIT_ANALYSIS_SYSTEM_PROMPT;

  // Add relevant few-shot examples based on occasion
  if (context?.occasion) {
    const relevantExamples = EXAMPLES_BY_OCCASION[context.occasion as keyof typeof EXAMPLES_BY_OCCASION] || [];

    if (relevantExamples.length > 0) {
      prompt += '\n\n# EXAMPLE ANALYSES (for reference)\n\n';
      relevantExamples.slice(0, 2).forEach((example, i) => {
        prompt += `Example ${i + 1}: ${example.occasion}\n`;
        prompt += `Context: ${JSON.stringify(example.context)}\n`;
        prompt += `Outfit: ${example.outfit.description}\n`;
        prompt += `Feedback:\n${JSON.stringify(example.exemplaryFeedback, null, 2)}\n\n`;
      });
    }
  }

  // Add relevant style knowledge
  prompt += '\n\n# STYLE KNOWLEDGE REFERENCE\n\n';
  prompt += 'You have access to these style rules for reference:\n';
  prompt += '- Color Theory: complementary, analogous, seasonal palettes\n';
  prompt += '- Fit Guidelines: shoulders, sleeves, pants, dresses\n';
  prompt += '- Quick Fix Database: common styling solutions\n';
  prompt += '\nUse this knowledge to provide specific, accurate feedback.\n';

  return prompt;
}

/**
 * Build user prompt for single outfit analysis
 */
export function buildOutfitAnalysisPrompt(
  imageDescription: string,
  context: OutfitContext
): string {
  let prompt = 'Please analyze this outfit:\n\n';
  prompt += `Description: ${imageDescription}\n\n`;
  prompt += `Context:\n`;
  if (context.occasion) prompt += `- Occasion: ${context.occasion}\n`;
  if (context.weather) prompt += `- Weather: ${context.weather}\n`;
  if (context.setting) prompt += `- Setting: ${context.setting}\n`;
  if (context.vibe) prompt += `- Desired vibe: ${context.vibe}\n`;
  if (context.concerns && context.concerns.length > 0) {
    prompt += `- Concerns: ${context.concerns.join(', ')}\n`;
  }

  prompt += '\nProvide detailed feedback following the Or This? brand voice.';
  prompt += '\nReturn your response as valid JSON matching the FeedbackTemplate structure.';

  return prompt;
}

/**
 * Build user prompt for outfit comparison ("Or This?")
 */
export function buildComparisonPrompt(
  outfit1Description: string,
  outfit2Description: string,
  context: OutfitContext
): string {
  let prompt = 'Please compare these two outfit options and recommend one:\n\n';
  prompt += `OPTION 1: ${outfit1Description}\n\n`;
  prompt += `OPTION 2: ${outfit2Description}\n\n`;
  prompt += `Context:\n`;
  if (context.occasion) prompt += `- Occasion: ${context.occasion}\n`;
  if (context.weather) prompt += `- Weather: ${context.weather}\n`;
  if (context.setting) prompt += `- Setting: ${context.setting}\n`;
  if (context.vibe) prompt += `- Desired vibe: ${context.vibe}\n`;

  prompt += '\nWhich option should they choose? Be decisive!';
  prompt += '\nReturn your response as valid JSON with "recommendation", "reasoning", "option1", and "option2" fields.';

  return prompt;
}

/**
 * Build prompt for follow-up question
 */
export function buildFollowUpPrompt(
  previousFeedback: FeedbackTemplate,
  followUpQuestion: string
): string {
  let prompt = FOLLOW_UP_PROMPT + '\n\n';
  prompt += '# PREVIOUS FEEDBACK\n\n';
  prompt += JSON.stringify(previousFeedback, null, 2);
  prompt += '\n\n# USER QUESTION\n\n';
  prompt += followUpQuestion;
  prompt += '\n\nProvide a helpful, conversational answer maintaining the Or This? brand voice.';

  return prompt;
}

/**
 * Validate and sanitize AI response
 */
export function validateAIResponse(response: any): {
  isValid: boolean;
  feedback?: FeedbackTemplate;
  errors: string[];
} {
  const errors: string[] = [];

  // Check if response is valid JSON
  if (typeof response !== 'object') {
    errors.push('Response is not a valid object');
    return { isValid: false, errors };
  }

  // Validate template structure
  const templateValidation = validateFeedbackTemplate(response);
  if (!templateValidation.isValid) {
    errors.push(...templateValidation.errors);
  }

  // Validate brand voice
  const feedbackText = [
    response.summary || '',
    ...(response.whatsWorking || []),
    ...(response.consider || []),
    ...(response.quickFixes || []),
  ].join(' ');

  const brandVoiceValidation = brandVoiceValidator.validate(feedbackText);
  if (!brandVoiceValidation.isValid) {
    errors.push(`Brand voice issues: ${brandVoiceValidation.issues.map(i => i.message).join(', ')}`);
  }

  // Check score ranges
  if (response.overallScore < 0 || response.overallScore > 10) {
    errors.push('Overall score out of range (0-10)');
  }

  return {
    isValid: errors.length === 0,
    feedback: errors.length === 0 ? response : undefined,
    errors,
  };
}

/**
 * Get relevant quick fixes from knowledge base
 */
export function getRelevantQuickFixes(
  issues: string[],
  context: OutfitContext
): string[] {
  const fixes: string[] = [];

  // Match issues to quick fix database
  Object.entries(QUICK_FIX_DATABASE).forEach(([key, fix]) => {
    const keywords = key.toLowerCase().split(/(?=[A-Z])/); // Split camelCase
    const matchesIssue = issues.some(issue =>
      keywords.some(keyword => issue.toLowerCase().includes(keyword))
    );

    if (matchesIssue) {
      fixes.push(fix);
    }
  });

  return fixes;
}

/**
 * Get color harmony suggestions
 */
export function getColorHarmonySuggestions(
  colors: string[],
  season?: string
): string[] {
  const suggestions: string[] = [];

  // Check if colors are complementary
  COLOR_THEORY.complementary.forEach(pair => {
    const hasColors = colors.some(c => c.toLowerCase().includes(pair.primary)) &&
                      colors.some(c => c.toLowerCase().includes(pair.complement));
    if (hasColors) {
      suggestions.push(`Great use of complementary colors (${pair.primary} and ${pair.complement})—${pair.vibe}`);
    }
  });

  // Season-specific suggestions
  if (season) {
    const seasonalPalette = COLOR_THEORY.seasons[season as keyof typeof COLOR_THEORY.seasons];
    if (seasonalPalette) {
      const hasSeasonalColor = colors.some(c =>
        seasonalPalette.bestColors.some(sc => c.toLowerCase().includes(sc))
      );
      if (hasSeasonalColor) {
        suggestions.push(`Perfect seasonal color choice for ${season}!`);
      }
    }
  }

  return suggestions;
}

/**
 * Enhanced AI call wrapper with validation and retry
 */
export async function callAIWithValidation(
  aiFunction: () => Promise<any>,
  maxRetries: number = 2
): Promise<{
  success: boolean;
  feedback?: FeedbackTemplate;
  errors: string[];
  attempts: number;
}> {
  let attempts = 0;
  let lastErrors: string[] = [];

  while (attempts < maxRetries) {
    attempts++;

    try {
      const response = await aiFunction();
      const validation = validateAIResponse(response);

      if (validation.isValid) {
        return {
          success: true,
          feedback: validation.feedback,
          errors: [],
          attempts,
        };
      }

      lastErrors = validation.errors;

      // If brand voice is the only issue and score is close, we might accept it
      const onlyBrandVoiceIssues = validation.errors.every(e => e.includes('Brand voice'));
      if (onlyBrandVoiceIssues && attempts === maxRetries) {
        console.warn('Accepting response with minor brand voice issues after retries');
        return {
          success: true,
          feedback: response,
          errors: validation.errors,
          attempts,
        };
      }

    } catch (error) {
      lastErrors = [`AI call failed: ${error}`];
    }
  }

  return {
    success: false,
    errors: lastErrors,
    attempts,
  };
}

/**
 * Example usage with OpenAI (pseudocode)
 */
export async function exampleOpenAIIntegration(
  imageUrl: string,
  context: OutfitContext
) {
  // Build prompts
  const systemPrompt = buildEnhancedSystemPrompt(context);
  const userPrompt = buildOutfitAnalysisPrompt('Burgundy wrap dress, nude heels', context);

  // Call OpenAI (pseudocode - you'll need to implement this)
  const aiCall = async () => {
    // return await openai.chat.completions.create({
    //   model: "gpt-4-vision-preview",
    //   messages: [
    //     { role: "system", content: systemPrompt },
    //     {
    //       role: "user",
    //       content: [
    //         { type: "text", text: userPrompt },
    //         { type: "image_url", image_url: { url: imageUrl } }
    //       ]
    //     }
    //   ],
    //   response_format: { type: "json_object" }
    // });
  };

  // Validate and retry if needed
  const result = await callAIWithValidation(aiCall, 2);

  if (!result.success) {
    throw new Error(`AI validation failed after ${result.attempts} attempts: ${result.errors.join(', ')}`);
  }

  return result.feedback;
}
