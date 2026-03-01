import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { handleSupportQuestion } from '../services/support-bot.service.js';

export async function askSupport(req: AuthenticatedRequest, res: Response) {
  const userId = req.userId!;
  const { question } = req.body;

  if (!question || typeof question !== 'string' || question.trim().length === 0) {
    throw new AppError(400, 'question is required');
  }
  if (question.length > 1000) {
    throw new AppError(400, 'Question too long (max 1000 chars)');
  }

  const result = await handleSupportQuestion(userId, question.trim());
  res.json(result);
}
