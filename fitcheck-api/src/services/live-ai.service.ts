import { GoogleGenerativeAI } from '@google/generative-ai';
import { prisma } from '../utils/prisma.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

export class LiveAIService {
  /**
   * Analyze a live stream outfit snapshot
   * This is a shorter, more conversational analysis for live chat
   */
  async analyzeLiveOutfit(
    sessionId: string,
    imageBase64: string,
    context?: {
      title?: string;
      hostUsername?: string;
    }
  ): Promise<string> {
    try {
      const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

      const prompt = `You are a friendly, encouraging style advisor watching a live outfit stream.

Give a quick, warm first impression in 2-3 sentences. Include:
- A score out of 10
- One specific thing that's working well
- One quick styling tip (if needed)

Keep it conversational and positive - this is live chat, not a formal review!

${context?.hostUsername ? `The streamer is @${context.hostUsername}.` : ''}
${context?.title ? `Stream title: "${context.title}"` : ''}`;

      const result = await model.generateContent([
        prompt,
        {
          inlineData: {
            mimeType: 'image/jpeg',
            data: imageBase64,
          },
        },
      ]);

      const feedback = result.response.text();

      // Save AI analysis to database
      const message = await prisma.liveChatMessage.create({
        data: {
          sessionId,
          userId: null, // AI message has no user
          isAi: true,
          messageType: 'ai_feedback',
          content: feedback,
        },
      });

      // Update session with AI analysis timestamp
      await prisma.liveSession.update({
        where: { id: sessionId },
        data: {
          aiAnalysisId: message.id,
          aiAnalyzedAt: new Date(),
        },
      });

      console.log(`✅ AI analyzed live session ${sessionId}`);
      return feedback;
    } catch (error) {
      console.error('Error analyzing live outfit:', error);
      throw error;
    }
  }

  /**
   * Extract score from AI feedback
   */
  extractScore(feedback: string): number | null {
    const scoreMatch = feedback.match(/(\d+(?:\.\d+)?)\s*(?:\/|out of)\s*10/i);
    if (scoreMatch) {
      return parseFloat(scoreMatch[1]);
    }
    return null;
  }
}

export const liveAIService = new LiveAIService();
