import OpenAI from 'openai';
import { OutfitFeedback, OutfitCheckInput } from '../types/index.js';
import { prisma } from '../utils/prisma.js';

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

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
    {"point": "<what works>", "detail": "<why it works>"}
  ],
  "consider": [
    {"point": "<what to consider>", "detail": "<why and how to address>"}
  ],
  "quickFixes": [
    {"suggestion": "<specific action>", "impact": "<what it improves>"}
  ],
  "occasionMatch": {
    "score": <number 1-10>,
    "notes": "<how well it fits the occasion>"
  }
}

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
    `- Occasion: ${input.occasion}`,
  ];

  if (input.setting) parts.push(`- Setting: ${input.setting}`);
  if (input.weather) parts.push(`- Weather: ${input.weather}`);
  if (input.vibe) parts.push(`- Desired vibe: ${input.vibe}`);
  if (input.specificConcerns) parts.push(`- User's concerns: ${input.specificConcerns}`);

  parts.push('', 'Provide your analysis as JSON.');

  return parts.join('\n');
}

export async function analyzeOutfit(
  outfitCheckId: string,
  input: OutfitCheckInput
): Promise<OutfitFeedback> {
  const maxRetries = 3;
  let lastError: Error | null = null;

  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await openai.chat.completions.create({
        model: 'gpt-4o',
        messages: [
          {
            role: 'system',
            content: SYSTEM_PROMPT,
          },
          {
            role: 'user',
            content: [
              {
                type: 'text',
                text: buildUserPrompt(input),
              },
              {
                type: 'image_url',
                image_url: {
                  url: input.imageUrl,
                  detail: 'high',
                },
              },
            ],
          },
        ],
        temperature: 0.7,
        max_tokens: 1000,
      });

      const content = response.choices[0]?.message?.content;
      if (!content) {
        throw new Error('No response from AI');
      }

      // Parse JSON response
      const feedback = JSON.parse(content) as OutfitFeedback;

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
    const response = await openai.chat.completions.create({
      model: 'gpt-4o',
      messages: [
        {
          role: 'system',
          content: systemPrompt,
        },
        {
          role: 'user',
          content: question,
        },
      ],
      temperature: 0.7,
      max_tokens: 300,
    });

    const answer = response.choices[0]?.message?.content || 'I apologize, but I could not generate a response. Please try again.';

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
