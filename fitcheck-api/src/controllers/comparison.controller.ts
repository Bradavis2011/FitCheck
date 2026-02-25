import { Response } from 'express';
import { z } from 'zod';
import { GoogleGenerativeAI } from '@google/generative-ai';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');

const CreateComparisonSchema = z.object({
  imageAData: z.string().optional(),
  imageAUrl: z.string().optional(),
  imageBData: z.string().optional(),
  imageBUrl: z.string().optional(),
  question: z.string().max(150).optional(),
  occasions: z.array(z.string()).min(1, 'At least one occasion is required'),
});

const VoteSchema = z.object({
  choice: z.enum(['A', 'B']),
});

/**
 * Create a new "Or This?" comparison post
 */
export async function createComparison(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;

  const data = CreateComparisonSchema.parse(req.body);

  if (!data.imageAData && !data.imageAUrl) {
    throw new AppError(400, 'Image A is required');
  }
  if (!data.imageBData && !data.imageBUrl) {
    throw new AppError(400, 'Image B is required');
  }

  const post = await prisma.comparisonPost.create({
    data: {
      userId,
      imageAData: data.imageAData,
      imageAUrl: data.imageAUrl,
      imageBData: data.imageBData,
      imageBUrl: data.imageBUrl,
      question: data.question,
      occasions: data.occasions,
    },
    select: {
      id: true,
      occasions: true,
      question: true,
      votesA: true,
      votesB: true,
      createdAt: true,
      user: { select: { id: true, username: true, name: true } },
    },
  });

  res.status(201).json(post);
}

/**
 * Get comparison post feed
 */
export async function getComparisonFeed(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;
  const { limit = '20', offset = '0' } = req.query;

  const posts = await prisma.comparisonPost.findMany({
    where: { isDeleted: false },
    orderBy: { createdAt: 'desc' },
    take: parseInt(limit as string),
    skip: parseInt(offset as string),
    select: {
      id: true,
      imageAUrl: true,
      imageAData: true,
      imageBUrl: true,
      imageBData: true,
      question: true,
      occasions: true,
      votesA: true,
      votesB: true,
      createdAt: true,
      user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
      votes: {
        where: { userId },
        select: { choice: true },
        take: 1,
      },
    },
  });

  const total = await prisma.comparisonPost.count({ where: { isDeleted: false } });

  const postsWithVoted = posts.map((post) => ({
    ...post,
    myVote: post.votes[0]?.choice || null,
    votes: undefined, // Remove raw votes array from response
  }));

  res.json({
    posts: postsWithVoted,
    hasMore: parseInt(offset as string) + posts.length < total,
  });
}

/**
 * Vote on a comparison post
 */
export async function voteOnComparison(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;
  const { id } = req.params;
  const { choice } = VoteSchema.parse(req.body);

  const post = await prisma.comparisonPost.findFirst({
    where: { id, isDeleted: false },
  });

  if (!post) {
    throw new AppError(404, 'Comparison post not found');
  }

  // Check if user already voted
  const existingVote = await prisma.comparisonVote.findUnique({
    where: { postId_userId: { postId: id, userId } },
  });

  if (existingVote) {
    if (existingVote.choice === choice) {
      // Same vote — no change needed
      return res.json({ success: true, votesA: post.votesA, votesB: post.votesB, myVote: choice });
    }

    // Changed vote — update
    await prisma.comparisonVote.update({
      where: { postId_userId: { postId: id, userId } },
      data: { choice },
    });

    const updatedPost = await prisma.comparisonPost.update({
      where: { id },
      data: {
        votesA: existingVote.choice === 'A' ? { decrement: 1 } : { increment: 1 },
        votesB: existingVote.choice === 'B' ? { decrement: 1 } : { increment: 1 },
      },
    });

    return res.json({ success: true, votesA: updatedPost.votesA, votesB: updatedPost.votesB, myVote: choice });
  }

  // New vote
  await prisma.comparisonVote.create({
    data: { postId: id, userId, choice },
  });

  const updatedPost = await prisma.comparisonPost.update({
    where: { id },
    data: {
      votesA: choice === 'A' ? { increment: 1 } : undefined,
      votesB: choice === 'B' ? { increment: 1 } : undefined,
    },
  });

  res.json({ success: true, votesA: updatedPost.votesA, votesB: updatedPost.votesB, myVote: choice });
}

const AnalyzeComparisonSchema = z.object({
  imageAData: z.string().min(1),
  imageBData: z.string().min(1),
  question: z.string().max(150).optional(),
  occasions: z.array(z.string()).optional(),
});

/**
 * AI side-by-side analysis of two outfit photos — returns winner + reasoning
 * Available to all authenticated users (no tier gate)
 */
export async function analyzeComparison(req: AuthenticatedRequest, res: Response) {
  const data = AnalyzeComparisonSchema.parse(req.body);

  const occasionText = data.occasions?.length ? data.occasions.join(', ') : 'general wear';
  const questionText = data.question ? `\nThe person is asking: "${data.question}"` : '';

  const prompt = `You are a professional personal stylist. Compare these two outfit photos.

Occasion: ${occasionText}${questionText}

Photo A is the FIRST image. Photo B is the SECOND image.

Give specific, honest feedback on each outfit and clearly recommend which one to wear for the occasion.

Respond in this exact JSON format with no markdown fences:
{
  "analysisA": "<2-3 sentences about outfit A: what works and any concerns>",
  "analysisB": "<2-3 sentences about outfit B: what works and any concerns>",
  "winner": "A",
  "reasoning": "<2-3 sentences explaining why the winner is the better choice for this occasion>"
}

Replace "A" in the winner field with either "A" or "B".`;

  // Strip data: URI prefix from base64 strings if present
  const imageABase64 = data.imageAData.includes(',') ? data.imageAData.split(',')[1] : data.imageAData;
  const imageBBase64 = data.imageBData.includes(',') ? data.imageBData.split(',')[1] : data.imageBData;

  const model = genAI.getGenerativeModel({ model: 'gemini-2.5-flash-lite' });
  const result = await model.generateContent([
    { text: prompt },
    { inlineData: { mimeType: 'image/jpeg', data: imageABase64 } },
    { inlineData: { mimeType: 'image/jpeg', data: imageBBase64 } },
  ]);

  const text = result.response.text().trim();
  const jsonText = text.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '').trim();

  let analysis: { analysisA: string; analysisB: string; winner: 'A' | 'B'; reasoning: string };
  try {
    analysis = JSON.parse(jsonText);
  } catch {
    throw new AppError(500, 'AI analysis returned an unexpected format. Please try again.');
  }

  res.json(analysis);
}

/**
 * Delete a comparison post (only owner can delete)
 */
export async function deleteComparison(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;
  const { id } = req.params;

  const post = await prisma.comparisonPost.findFirst({
    where: { id, userId, isDeleted: false },
  });

  if (!post) {
    throw new AppError(404, 'Comparison post not found');
  }

  await prisma.comparisonPost.update({
    where: { id },
    data: { isDeleted: true },
  });

  res.json({ success: true });
}
