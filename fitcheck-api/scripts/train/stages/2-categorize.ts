/**
 * STAGE 2: CATEGORIZE
 * Use Gemini to auto-tag images with occasion, setting, weather, vibe
 */

import fs from 'fs';
import path from 'path';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { ImageSource, CategorizedImage } from '../types.js';
import { config } from '../config.js';
import { Logger } from '../utils/logger.js';
import { RateLimiter } from '../utils/rate-limiter.js';

const genAI = new GoogleGenerativeAI(config.geminiApiKey);

const CATEGORIZATION_PROMPT = `Analyze this outfit image and extract the following information:

1. **occasions** (array): What occasions is this outfit appropriate for? Choose from: casual, work, date night, wedding guest, party, brunch, job interview, gym, cocktail party, beach, formal event, etc.
2. **setting**: Where might this outfit be worn? (e.g., restaurant, office, outdoor, nightclub, etc.)
3. **weather**: What weather is this outfit suited for? (warm, cold, mild, hot, rainy, etc.)
4. **vibe**: What vibe/aesthetic does this outfit give? (e.g., romantic, professional, edgy, casual, elegant, sporty, etc.)
5. **outfitDescription**: Detailed description of the outfit - list every visible garment, accessory, color, and styling detail
6. **difficultyEstimate**: How challenging is this outfit to evaluate? (easy/medium/hard)
   - easy: Simple, clear outfit with obvious elements
   - medium: Layered outfit or mixed styles
   - hard: Complex, avant-garde, or ambiguous styling

Return ONLY valid JSON matching this structure:
{
  "occasions": ["<occasion1>", "<occasion2>"],
  "setting": "<setting>",
  "weather": "<weather>",
  "vibe": "<vibe>",
  "outfitDescription": "<detailed description>",
  "difficultyEstimate": "easy|medium|hard"
}`;

export async function categorize(
  runId: string,
  dataDir: string,
  images: ImageSource[],
  logger: Logger
): Promise<CategorizedImage[]> {
  logger.stage(2, 'CATEGORIZE');

  const rateLimiter = new RateLimiter(config.geminiRateLimitRPM);
  const categorized: CategorizedImage[] = [];

  const categorizedDir = path.join(dataDir, 'categorized', runId);
  fs.mkdirSync(categorizedDir, { recursive: true });

  for (let i = 0; i < images.length; i++) {
    const image = images[i];
    logger.progress(i + 1, images.length, image.id);

    // Skip synthetic images - they don't have actual images to analyze
    if (image.source === 'synthetic') {
      // Use predefined context for synthetic scenarios
      const syntheticContext = getSyntheticContext(image.id);
      const cat: CategorizedImage = {
        ...image,
        ...syntheticContext,
      };
      categorized.push(cat);
      continue;
    }

    try {
      const result = await rateLimiter.execute(async () => {
        const model = genAI.getGenerativeModel({
          model: 'gemini-2.5-flash',
          generationConfig: {
            temperature: 0.3,
            responseMimeType: 'application/json',
          },
        });

        const imagePart = {
          inlineData: {
            mimeType: image.mimeType,
            data: image.base64,
          },
        };

        const response = await model.generateContent([CATEGORIZATION_PROMPT, imagePart]);
        return response.response.text();
      });

      const parsed = JSON.parse(result);

      const cat: CategorizedImage = {
        ...image,
        occasion: parsed.occasions || [],
        setting: parsed.setting,
        weather: parsed.weather,
        vibe: parsed.vibe,
        outfitDescription: parsed.outfitDescription,
        difficultyEstimate: parsed.difficultyEstimate || 'medium',
      };

      categorized.push(cat);

      // Save individual categorization
      fs.writeFileSync(
        path.join(categorizedDir, `${image.id}.json`),
        JSON.stringify(cat, null, 2)
      );
    } catch (error) {
      logger.error(`Failed to categorize ${image.id}: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Fallback to generic categorization
      const cat: CategorizedImage = {
        ...image,
        occasion: ['casual'],
        setting: 'general',
        weather: 'mild',
        vibe: 'casual',
        outfitDescription: 'Outfit visible in image',
        difficultyEstimate: 'medium',
      };
      categorized.push(cat);
    }
  }

  logger.success(`Categorized ${categorized.length} images`);
  return categorized;
}

function getSyntheticContext(imageId: string): Omit<CategorizedImage, keyof ImageSource> {
  // Predefined contexts for synthetic scenarios
  const contexts: Record<string, Omit<CategorizedImage, keyof ImageSource>> = {
    'synthetic-1': {
      occasion: ['date night'],
      setting: 'restaurant',
      weather: 'mild',
      vibe: 'romantic',
      outfitDescription: 'Red wrap dress with black heels and gold jewelry',
      difficultyEstimate: 'easy',
    },
    'synthetic-2': {
      occasion: ['work'],
      setting: 'office',
      weather: 'mild',
      vibe: 'professional',
      outfitDescription: 'Navy blazer, white blouse, gray trousers, black pumps',
      difficultyEstimate: 'easy',
    },
    'synthetic-3': {
      occasion: ['casual'],
      setting: 'coffee shop',
      weather: 'warm',
      vibe: 'relaxed',
      outfitDescription: 'Light blue jeans, white t-shirt, olive bomber jacket, white sneakers',
      difficultyEstimate: 'easy',
    },
  };

  return contexts[imageId] || {
    occasion: ['casual'],
    setting: 'general',
    weather: 'mild',
    vibe: 'casual',
    outfitDescription: 'Casual outfit',
    difficultyEstimate: 'medium',
  };
}
