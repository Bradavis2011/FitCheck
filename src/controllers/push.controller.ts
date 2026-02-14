import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { pushService } from '../services/push.service.js';

// Validation schema
const RegisterTokenSchema = z.object({
  token: z.string(),
  platform: z.enum(['ios', 'android']),
});

/**
 * Register a push notification token for the authenticated user
 */
export async function registerPushToken(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const data = RegisterTokenSchema.parse(req.body);

    await pushService.registerPushToken(userId, data.token, data.platform);

    res.json({ success: true, message: 'Push token registered successfully' });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid request data');
    }
    throw error;
  }
}

/**
 * Unregister a push notification token
 */
export async function unregisterPushToken(req: AuthenticatedRequest, res: Response) {
  try {
    const { token } = req.body;

    if (!token) {
      throw new AppError(400, 'Token is required');
    }

    await pushService.unregisterPushToken(token);

    res.json({ success: true, message: 'Push token unregistered successfully' });
  } catch (error) {
    throw error;
  }
}
