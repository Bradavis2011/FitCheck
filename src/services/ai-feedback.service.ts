import { GoogleGenerativeAI } from '@google/generative-ai';
import { OutfitFeedback, OutfitCheckInput } from '../types/index.js';
import { prisma } from '../utils/prisma.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const SYSTEM_PROMPT = `You are a friendly, supportive personal stylist providing outfit feedback to help people feel confident.

PERSONALITY:
- Warm and encouraging, like a supportive best friend
- Honest but tactful - find positives even when suggesting changes
- Specific and actionable in your advice
- Never judgmental about body types or personal style choices

ANALYSIS APPROACH:
1. First, identify what IS working - always lead with positives
2. Consider the stated occasion and evaluate appropriateness
3. Look at color coordination, fit, proportions, and style cohesion
4. Address any specific concerns the user mentioned
5. Offer 1-2 quick, actionable improvements

RESPONSE FORMAT:
Return ONLY valid JSON matching this exact structure:
{
  "overallScore": <number 1-10>,
  "summary": "<one encouraging sentence about the overall look>",
  "whatsWorking": [
    {"point": "<brief title, 2-5 words>", "detail": "<specific observation, 1-2 sentences>"},
    {"point": "<brief title, 2-5 words>", "detail": "<specific observation, 1-2 sentences>"}
  ],
  "consider": [
    {"point": "<brief title, 2-5 words>", "detail": "<helpful suggestion, 1-2 sentences>"},
    {"point": "<brief title, 2-5 words>", "detail": "<helpful suggestion, 1-2 sentences>"}
  ],
  "quickFixes": [
    {"suggestion": "<actionable tip>", "impact": "<benefit in 8-12 words>"}
  ],
  "occasionMatch": {
    "score": <number 1-10>,
    "notes": "<how well it fits the occasion>"
  }
}

Be specific and helpful. Give 2-3 items for whatsWorking and consider each.

SCORING GUIDE:
- 1-4: Significant issues (rare - be constructive)
- 5-6: Works but has clear room for improvement
- 7-8: Good outfit, minor tweaks possible (most outfits)
- 9-10: Excellent, well-executed (reserve for standouts)`;

function buildUserPrompt(input: OutfitCheckInput): string {
  const parts = [
    'Analyze this outfit photo.',
    '',
    'Context provided by user:',
    `- Occasion(s): ${input.occasions.join(', ')}`,
  ];

  if (input.setting) parts.push(`- Setting: ${input.setting}`);
  if (input.weather) parts.push(`- Weather: ${input.weather}`);
  if (input.vibe) parts.push(`- Desired vibe: ${input.vibe}`);
  if (input.specificConcerns) parts.push(`- User's concerns: ${input.specificConcerns}`);

  parts.push('', 'Provide your analysis as JSON.');

  return parts.join('\n');
}

// Helper to strip markdown code fences from JSON responses
function stripMarkdownFences(text: string): string {
  // Remove ```json and ``` markers if present
  return text.replace(/^```json\s*\n?/i, '').replace(/\n?```\s*$/, '').trim();
}

export async function analyzeOutfit(
  outfitCheckId: string,
  input: OutfitCheckInput
): Promise<OutfitFeedback> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const model = genAI.getGenerativeModel({
        model: 'gemini-2.5-flash',
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: {
          temperature: 0.5, // Lower temp for more consistent output
          maxOutputTokens: 2048,
          responseMimeType: 'application/json', // Force JSON format
          responseSchema: {
            type: 'object',
            properties: {
              overallScore: { type: 'number' },
              summary: { type: 'string' },
              whatsWorking: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    point: { type: 'string' },
                    detail: { type: 'string' }
                  }
                }
              },
              consider: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    point: { type: 'string' },
                    detail: { type: 'string' }
                  }
                }
              },
              quickFixes: {
                type: 'array',
                items: {
                  type: 'object',
                  properties: {
                    suggestion: { type: 'string' },
                    impact: { type: 'string' }
                  }
                }
              },
              occasionMatch: {
                type: 'object',
                properties: {
                  score: { type: 'number' },
                  notes: { type: 'string' }
                }
              }
            },
            required: ['overallScore', 'summary', 'whatsWorking', 'consider', 'quickFixes', 'occasionMatch']
          }
        },
      });

      // Prepare image data for Gemini
      let imagePart;
      if (input.imageBase64) {
        // Base64 image data
        imagePart = {
          inlineData: {
            mimeType: 'image/jpeg',
            data: input.imageBase64,
          },
        };
      } else if (input.imageUrl) {
        // For URL-based images, we'd need to fetch and convert to base64
        // For now, throw error if imageBase64 is not provided
        throw new Error('Image must be provided as base64 data');
      } else {
        throw new Error('No image data provided');
      }

      const result = await model.generateContent([
        buildUserPrompt(input),
        imagePart,
      ]);

      const response = await result.response;
      const content = response.text();

      if (!content) {
        throw new Error('No response from AI');
      }

      // Parse JSON response (strip any markdown fences first)
      const cleanContent = stripMarkdownFences(content);

      // Try to parse JSON - if it fails, log the raw content for debugging
      let feedback: OutfitFeedback;
      try {
        feedback = JSON.parse(cleanContent) as OutfitFeedback;
      } catch (parseError) {
        console.error('JSON parse error. Raw content:', cleanContent.substring(0, 500));
        throw new Error(`Invalid JSON from AI: ${parseError instanceof Error ? parseError.message : 'Unknown error'}`);
      }

      // Validate response structure
      if (
        typeof feedback.overallScore !== 'number' ||
        !feedback.summary ||
        !Array.isArray(feedback.whatsWorking)
      ) {
        throw new Error('Invalid feedback structure');
      }

      // Update database with feedback
      await prisma.outfitCheck.update({
        where: { id: outfitCheckId },
        data: {
          aiFeedback: feedback as any,
          aiScore: feedback.overallScore,
          aiProcessedAt: new Date(),
        },
      });

      return feedback;
    } catch (error) {
      lastError = error as Error;
      console.error(`AI feedback attempt ${attempt} failed:`, error);

      if (attempt < maxRetries) {
        // Exponential backoff
        await new Promise((resolve) => setTimeout(resolve, Math.pow(2, attempt) * 1000));
      }
    }
  }

  // If all retries failed, return a fallback response
  console.error('All AI feedback attempts failed, using fallback');
  const fallbackFeedback: OutfitFeedback = {
    overallScore: 7,
    summary: "Looking good! We're having trouble analyzing the details right now, but your outfit has great potential.",
    whatsWorking: [
      {
        point: 'Overall presentation',
        detail: 'You look put together and ready for the occasion',
      },
    ],
    consider: [
      {
        point: 'Try again for detailed feedback',
        detail: "We're experiencing technical difficulties. Your next check will have full analysis!",
      },
    ],
    quickFixes: [],
    occasionMatch: {
      score: 7,
      notes: 'Appropriate for the occasion',
    },
  };

  await prisma.outfitCheck.update({
    where: { id: outfitCheckId },
    data: {
      aiFeedback: fallbackFeedback as any,
      aiScore: fallbackFeedback.overallScore,
      aiProcessedAt: new Date(),
    },
  });

  return fallbackFeedback;
}

export async function handleFollowUpQuestion(
  outfitCheckId: string,
  question: string
): Promise<string> {
  // Get original outfit check and feedback
  const outfitCheck = await prisma.outfitCheck.findUnique({
    where: { id: outfitCheckId },
    include: { followUps: true },
  });

  if (!outfitCheck) {
    throw new Error('Outfit check not found');
  }

  const previousFeedback = outfitCheck.aiFeedback as OutfitFeedback;
  const previousScore = outfitCheck.aiScore;

  const systemPrompt = `You are continuing a conversation about an outfit you previously analyzed.

Previous analysis summary: ${previousFeedback?.summary || 'N/A'}
Score given: ${previousScore}/10

The user has a follow-up question. Answer helpfully and specifically, keeping your warm, supportive tone. If they ask for product recommendations, suggest general categories/styles rather than specific brands (unless they ask).

Keep responses concise (2-4 sentences) but helpful.`;

  try {
    const model = genAI.getGenerativeModel({
      model: 'gemini-2.5-flash',
      systemInstruction: systemPrompt,
      generationConfig: {
        temperature: 0.7,
        maxOutputTokens: 300,
      },
    });

    const result = await model.generateContent(question);
    const response = await result.response;
    const answer = response.text() || 'I apologize, but I could not generate a response. Please try again.';

    // Save follow-up to database
    await prisma.followUp.create({
      data: {
        outfitCheckId,
        userQuestion: question,
        aiResponse: answer,
      },
    });

    return answer;
  } catch (error) {
    console.error('Follow-up question failed:', error);
    return 'I apologize, but I encountered an issue processing your question. Please try again in a moment.';
  }
}
