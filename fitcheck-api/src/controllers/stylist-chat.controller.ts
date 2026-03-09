import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import {
  handleStylistMessage,
  getStylistChatHistory,
  getDailyMessageLimit,
} from '../services/stylist-chat.service.js';

// POST /api/stylist-chat
export async function sendMessage(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const { message } = req.body;

  if (!message || typeof message !== 'string' || !message.trim()) {
    throw new AppError(400, 'Message is required');
  }
  if (message.length > 1000) {
    throw new AppError(400, 'Message too long (max 1000 characters)');
  }

  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
  const tier = user?.tier || 'free';

  try {
    const result = await handleStylistMessage(userId, message.trim(), tier);
    res.json(result);
  } catch (err: any) {
    if (err?.status === 429) {
      throw new AppError(429, 'Daily message limit reached. Upgrade for more messages.');
    }
    throw err;
  }
}

// GET /api/stylist-chat
export async function getChatHistory(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const page = Math.max(1, parseInt(String(req.query.page || '1'), 10));
  const limit = Math.min(50, Math.max(1, parseInt(String(req.query.limit || '20'), 10)));

  const result = await getStylistChatHistory(userId, page, limit);
  res.json(result);
}

// GET /api/stylist-chat/status
export async function getChatStatus(req: AuthenticatedRequest, res: Response) {
  const userId = req.user!.id;
  const user = await prisma.user.findUnique({ where: { id: userId }, select: { tier: true } });
  const tier = user?.tier || 'free';

  const status = await getDailyMessageLimit(userId, tier);
  res.json(status);
}
