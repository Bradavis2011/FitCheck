/**
 * STAGE 3: TEST
 * Run production AI on each image (2x for consistency)
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { CategorizedImage, AIResponse } from '../types.js';
import { SYSTEM_PROMPT, RESPONSE_SCHEMA } from '../../../src/services/ai-feedback.service.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

export async function test(
  runId: string,
  dataDir: string,
  images: CategorizedImage[],
  logger: Logger
): Promise<AIResponse[]> {
  logger.stage(3, 'TEST');

  const rateLimiter = new RateLimiter(config.geminiRateLimitRPM);
  const responses: AIResponse[] = [];

  const resultsDir = path.join(dataDir, 'results', runId);
  fs.mkdirSync(resultsDir, { recursive: true });

  // Run each image 2x for consistency testing
  for (let runNumber = 1; runNumber <= config.consistencyRuns; runNumber++) {
    logger.info(`\n📍 Consistency run ${runNumber}/${config.consistencyRuns}`);

    for (let i = 0; i < images.length; i++) {
      const image = images[i];
      logger.progress(i + 1, images.length, `${image.id} (run ${runNumber})`);

      const startTime = Date.now();

      try {
        const result = await rateLimiter.execute(async () => {
          const model = genAI.getGenerativeModel({
            model: 'gemini-2.5-flash',
            systemInstruction: SYSTEM_PROMPT,
            generationConfig: {
              temperature: 0.5,
              maxOutputTokens: 4096, // Increased to prevent truncation
              responseMimeType: 'application/json',
              responseSchema: RESPONSE_SCHEMA as any,
            },
          });

          // Build user prompt
          const userPrompt = buildUserPrompt(image);

          // For synthetic images (text only), don't send image part
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

        const latency = Date.now() - startTime;

        // Clean and repair JSON before parsing
        const cleanedResult = cleanAndRepairJSON(result);
        const parsed = JSON.parse(cleanedResult);

        const aiResponse: AIResponse = {
          imageId: image.id,
          runNumber: runNumber as 1 | 2,
          response: parsed,
          latencyMs: latency,
          tokenUsage: undefined, // Gemini doesn't expose token counts in free tier
        };

        responses.push(aiResponse);

        // Save individual response
        fs.writeFileSync(
          path.join(resultsDir, `${image.id}-run${runNumber}.json`),
          JSON.stringify(aiResponse, null, 2)
        );
      } catch (error) {
        logger.error(`Failed to test ${image.id} (run ${runNumber}): ${error instanceof Error ? error.message : 'Unknown error'}`);

        // Log the error response
        const errorResponse: AIResponse = {
          imageId: image.id,
          runNumber: runNumber as 1 | 2,
          response: null,
          latencyMs: Date.now() - startTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
        responses.push(errorResponse);
      }
    }
  }

  const successCount = responses.filter(r => !r.error).length;
  logger.success(`Completed ${successCount}/${responses.length} AI responses`);

  return responses;
}

/**
 * Clean and repair common JSON issues from Gemini responses
 */
function cleanAndRepairJSON(text: string): string {
  // 1. Strip markdown code fences
  text = text.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/i, '').trim();

  // 2. Try parsing as-is first
  try {
    JSON.parse(text);
    return text;
  } catch (firstError) {
    // Aggressive repair: rebuild the JSON by properly escaping all string values
    try {
      // Use a more sophisticated approach: parse as much as possible and repair
      // This regex matches JSON string values more carefully
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
          // Inside a string - escape special characters
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

      // Try parsing the repaired version
      JSON.parse(result);
      return result;
    } catch (secondError) {
      // If all repair attempts fail, return original
      // The calling code will catch and log this
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

  // For synthetic images, include the outfit description as "user's concerns"
  if (image.source === 'synthetic') {
    parts.push(`- User's outfit: ${image.outfitDescription}`);
  }

  parts.push('', 'Provide your analysis as JSON.');

  return parts.join('\n');
}
