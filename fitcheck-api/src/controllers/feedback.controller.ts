import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

const VALID_TYPES = ['bug', 'feature', 'general', 'complaint', 'praise'] as const;

export async function submitFeedback(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;
  const { type, text } = req.body;

  if (!type || !VALID_TYPES.includes(type)) {
    throw new AppError(400, `type must be one of: ${VALID_TYPES.join(', ')}`);
  }
  if (!text || typeof text !== 'string' || text.trim().length === 0) {
    throw new AppError(400, 'text is required');
  }
  if (text.length > 2000) {
    throw new AppError(400, 'Feedback text too long (max 2000 chars)');
  }

  const feedback = await prisma.userFeedback.create({
    data: { userId, type, text: text.trim(), status: 'open' },
  });

  res.status(201).json({ success: true, id: feedback.id });
}
