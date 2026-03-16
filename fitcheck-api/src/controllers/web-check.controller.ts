/**
 * Web Check Controller
 *
 * Unauthenticated outfit scoring for orthis.app/try.
 * Returns a stripped-down score + 2 "what's working" items.
 * Full analysis (quick fixes, follow-ups, StyleDNA) requires the app.
 *
 * Rate limited: 3 checks per IP per 24h (via webCheckLimiter middleware).
 */

import { Request, Response } from 'express';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { z } from 'zod';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const OCCASIONS = ['Work', 'Date Night', 'Casual', 'Interview', 'Event', 'Weekend'] as const;
type Occasion = typeof OCCASIONS[number];

const WebCheckSchema = z.object({
  imageBase64: z.string().min(100),
  occasions: z.array(z.string()).min(1).max(3),
});

const SYSTEM_PROMPT = `You are a concise AI outfit stylist. Analyze this outfit photo and return ONLY valid JSON.
Be honest and direct. Output must be exactly this structure with no extra text:
{
  "score": <integer 1-10>,
  "whatsWorking": ["<item 1, max 12 words>", "<item 2, max 12 words>"],
  "occasion": "<best occasion match from the list provided>"
}`;

export async function webCheck(req: Request, res: Response): Promise<void> {
  try {
    const parsed = WebCheckSchema.safeParse(req.body);
    if (!parsed.success) {
      res.status(400).json({ error: 'Invalid request. Provide imageBase64 and occasions.' });
      return;
    }

    const { imageBase64, occasions } = parsed.data;

    // Validate base64 image
    const mimeMatch = imageBase64.match(/^data:(image\/[\w+]+);base64,/);
    if (!mimeMatch) {
      res.status(400).json({ error: 'imageBase64 must be a valid data URI (image/jpeg, image/png, image/webp)' });
      return;
    }

    const allowedMime = ['image/jpeg', 'image/jpg', 'image/png', 'image/webp'];
    if (!allowedMime.includes(mimeMatch[1])) {
      res.status(400).json({ error: 'Unsupported image type. Use JPEG, PNG, or WEBP.' });
      return;
    }

    // Size check: ~2MB max for web (base64 chars × 0.75 ≈ bytes)
    const base64Data = imageBase64.replace(/^data:image\/[\w+]+;base64,/, '');
    const estimatedBytes = Math.ceil(base64Data.length * 0.75);
    if (estimatedBytes > 2 * 1024 * 1024) {
      res.status(400).json({ error: 'Image exceeds 2MB limit. Please use a smaller image.' });
      return;
    }

    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash-lite',
      generationConfig: { maxOutputTokens: 500, temperature: 0.4 },
    });

    const occasionList = occasions.slice(0, 3).join(', ');
    const prompt = `${SYSTEM_PROMPT}

Occasion(s): ${occasionList}
Pick the best matching occasion from: ${OCCASIONS.join(', ')}`;

    const result = await model.generateContent([
      { text: prompt },
      {
        inlineData: {
          mimeType: mimeMatch[1] as 'image/jpeg' | 'image/png' | 'image/webp',
          data: base64Data,
        },
      },
    ]);

    const raw = result.response.text().trim();

    // Extract JSON
    const jsonMatch = raw.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      console.error('[WebCheck] No JSON in Gemini response:', raw.slice(0, 200));
      res.status(500).json({ error: 'AI response error. Please try again.' });
      return;
    }

    const parsed2 = JSON.parse(jsonMatch[0]) as {
      score?: number;
      whatsWorking?: string[];
      occasion?: string;
    };

    const score = Math.min(10, Math.max(1, Math.round(parsed2.score ?? 5)));
    const whatsWorking = (parsed2.whatsWorking ?? []).slice(0, 2).map(String);
    const occasion = String(parsed2.occasion ?? occasions[0] ?? 'Casual');

    res.json({ score, whatsWorking, occasion });
  } catch (err) {
    console.error('[WebCheck] Error:', err);
    res.status(500).json({ error: 'Something went wrong. Please try again.' });
  }
}
