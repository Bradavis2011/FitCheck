/**
 * STAGE 6: OPTIMIZE
 * Use Gemini to self-improve the prompt based on weakness analysis
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { WeaknessAnalysis, OptimizationResult, QualityScores, CategorizedImage } from '../types.js';
import { SYSTEM_PROMPT } from '../../../src/services/ai-feedback.service.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const META_PROMPT = `You are an expert AI prompt engineer specializing in fashion and personal styling applications.

You will be given:
1. The current system prompt for an outfit feedback AI
2. A detailed weakness analysis showing specific issues found during testing

Your task is to produce an IMPROVED version of the prompt that addresses EACH weakness while maintaining:
- The warm, supportive brand voice (Decisive, Warm, Confident, Real)
- The comprehensive fashion knowledge base
- The structured JSON output format
- The example analyses

CRITICAL IMPROVEMENTS TO MAKE:

{{WEAKNESS_INSTRUCTIONS}}

OUTPUT INSTRUCTIONS:
- Return ONLY the complete improved prompt text
- DO NOT include any preamble like "Here's the improved prompt:"
- DO NOT wrap in markdown code fences
- The output should be ready to use as-is
- Maintain all the original structure (sections, examples, formatting)
- Keep the fashion knowledge base intact
- Update the PERSONALITY, ANALYSIS APPROACH, or add new EXAMPLE ANALYSES as needed`;

export async function optimize(
  runId: string,
  dataDir: string,
  weaknessAnalysis: WeaknessAnalysis,
  qualityScores: QualityScores[],
  images: CategorizedImage[],
  logger: Logger
): Promise<OptimizationResult | null> {
  if (!config.enableOptimization) {
    logger.info('Optimization disabled in config - skipping');
    return null;
  }

  logger.stage(6, 'OPTIMIZE');

  // Build weakness-specific instructions
  const weaknessInstructions = weaknessAnalysis.topWeaknesses
    .map((w, i) => `${i + 1}. ${w.category} (${w.severity} severity): ${w.suggestedFix}\n   Examples: ${w.examples.slice(0, 2).join('; ')}`)
    .join('\n\n');

  const metaPromptFinal = META_PROMPT.replace('{{WEAKNESS_INSTRUCTIONS}}', weaknessInstructions);

  logger.info('Generating optimized prompt...');

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 8192, // Allow long prompts
      },
    });

    const geminiResult = await model.generateContent([
      metaPromptFinal,
      `\nCurrent prompt:\n\n${SYSTEM_PROMPT}`,
    ]);

    const optimizedPrompt = geminiResult.response.text().trim();

    // Save optimized prompt
    const promptFile = path.join(dataDir, 'results', runId, 'optimized-prompt.txt');
    fs.writeFileSync(promptFile, optimizedPrompt);

    logger.success('Generated optimized prompt');

    // Test the optimized prompt on weak images
    logger.info(`Testing optimized prompt on ${config.optimizationSampleSize} weak images...`);

    const weakImages = selectWeakImages(qualityScores, images, config.optimizationSampleSize);
    const testResults = await testOptimizedPrompt(optimizedPrompt, weakImages, qualityScores, logger);

    const avgImprovement =
      testResults.reduce((sum, r) => sum + r.improvement, 0) / testResults.length;

    const result: OptimizationResult = {
      originalPrompt: SYSTEM_PROMPT,
      optimizedPrompt,
      testResults,
      avgImprovement,
      successful: avgImprovement > 2, // At least +2 points average improvement
    };

    // Save optimization result
    const resultFile = path.join(dataDir, 'results', runId, 'optimization-result.json');
    fs.writeFileSync(resultFile, JSON.stringify(result, null, 2));

    logger.metric('Average improvement', `${avgImprovement > 0 ? '+' : ''}${avgImprovement.toFixed(1)} points`);
    logger.metric('Success', result.successful ? 'YES ✅' : 'NO ❌');

    return result;
  } catch (error) {
    logger.error(`Optimization failed: ${error instanceof Error ? error.message : 'Unknown error'}`);
    return null;
  }
}

function selectWeakImages(
  qualityScores: QualityScores[],
  images: CategorizedImage[],
  count: number
): CategorizedImage[] {
  // Sort by lowest average quality score
  const scored = qualityScores.map(s => ({
    imageId: s.imageId,
    avgQuality: (s.brandVoiceScore + s.specificityScore + s.actionabilityScore) / 3,
  }));

  scored.sort((a, b) => a.avgQuality - b.avgQuality);

  const weakIds = scored.slice(0, count).map(s => s.imageId);
  return images.filter(img => weakIds.includes(img.id));
}

async function testOptimizedPrompt(
  optimizedPrompt: string,
  images: CategorizedImage[],
  originalScores: QualityScores[],
  logger: Logger
): Promise<OptimizationResult['testResults']> {
  const rateLimiter = new RateLimiter(config.geminiRateLimitRPM);
  const results: OptimizationResult['testResults'] = [];

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    logger.progress(i + 1, images.length, image.id);

    try {
      const result = await rateLimiter.execute(async () => {
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          systemInstruction: optimizedPrompt,
          generationConfig: {
            temperature: 0.5,
            maxOutputTokens: 2048,
            responseMimeType: 'application/json',
          },
        });

        const userPrompt = buildUserPrompt(image);
        const parts = image.source === 'synthetic'
          ? [userPrompt]
          : [
              userPrompt,
              {
                inlineData: {
                  mimeType: image.mimeType,
                  data: image.base64,
                },
              },
            ];

        const response = await model.generateContent(parts);
        return response.response.text();
      });

      // Clean and repair JSON before parsing
      const cleanedResult = cleanAndRepairJSON(result);
      const parsed = JSON.parse(cleanedResult);

      // Quick quality score (simplified)
      const optimizedScore = (parsed.overallScore || 0) * 10; // Convert to 0-100

      const originalScore = originalScores
        .filter(s => s.imageId === image.id)
        .map(s => (s.brandVoiceScore + s.specificityScore + s.actionabilityScore) / 3)
        [0] || 0;

      results.push({
        imageId: image.id,
        originalScore,
        optimizedScore,
        improvement: optimizedScore - originalScore,
      });
    } catch (error) {
      logger.error(`Failed to test ${image.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);
    }
  }

  return results;
}

/**
 * Clean and repair common JSON issues from Gemini responses
 */
function cleanAndRepairJSON(text: string): string {
  text = text.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  try {
    JSON.parse(text);
    return text;
  } catch (firstError) {
    try {
      let inString = false;
      let escaped = false;
      let result = '';

      for (let i = 0; i < text.length; i++) {
        const char = text[i];
        const prevChar = i > 0 ? text[i - 1] : '';

        if (char === '"' && prevChar !== '\\') {
          inString = !inString;
          result += char;
        } else if (inString) {
          if (char === '\\' && !escaped) {
            escaped = true;
            result += char;
          } else if (escaped) {
            escaped = false;
            result += char;
          } else if (char === '\n') {
            result += '\\n';
          } else if (char === '\r') {
            result += '\\r';
          } else if (char === '\t') {
            result += '\\t';
          } else {
            result += char;
          }
        } else {
          result += char;
        }
      }

      JSON.parse(result);
      return result;
    } catch (secondError) {
      return text;
    }
  }
}

function buildUserPrompt(image: CategorizedImage): string {
  const parts = [
    'Analyze this outfit photo.',
    '',
    'Context provided by user:',
    `- Occasion(s): ${image.occasion.join(', ')}`,
  ];

  if (image.setting) parts.push(`- Setting: ${image.setting}`);
  if (image.weather) parts.push(`- Weather: ${image.weather}`);
  if (image.vibe) parts.push(`- Desired vibe: ${image.vibe}`);

  if (image.source === 'synthetic') {
    parts.push(`- User's outfit: ${image.outfitDescription}`);
  }

  parts.push('', 'Provide your analysis as JSON.');

  return parts.join('\n');
}
