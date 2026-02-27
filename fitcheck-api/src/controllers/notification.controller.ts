
import { Response } from 'express';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { pushService } from '../services/push.service.js';

// Get user's notifications
export async function getNotifications(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { limit = '50', offset = '0', unreadOnly = 'false' } = req.query;

    const where: any = { userId };
    if (unreadOnly === 'true') {
      where.isRead = false;
    }

    const notifications = await prisma.notification.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      take: Math.min(100, parseInt(limit as string) || 50),
      skip: Math.min(10000, parseInt(offset as string) || 0),
    });

    const unreadCount = await prisma.notification.count({
      where: { userId, isRead: false },
    });

    res.json({
      notifications,
      unreadCount,
    });
  } catch (error) {
    throw error;
  }
}

// Mark a notification as read
export async function markNotificationRead(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const notification = await prisma.notification.findFirst({
      where: { id, userId },
    });

    if (!notification) {
      throw new AppError(404, 'Notification not found');
    }

    await prisma.notification.update({
      where: { id },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    throw error;
  }
}

// Mark all notifications as read
export async function markAllNotificationsRead(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    await prisma.notification.updateMany({
      where: { userId, isRead: false },
      data: { isRead: true },
    });

    res.json({ success: true });
  } catch (error) {
    throw error;
  }
}

// Helper function to create a notification (used by other controllers)
export async function createNotification(data: {
  userId: string;
  type: string;
  title: string;
  body: string;
  linkType?: string;
  linkId?: string;
}): Promise<void> {
  try {
    // Create notification in database
    await prisma.notification.create({
      data: {
        userId: data.userId,
        type: data.type,
        title: data.title,
        body: data.body,
        linkType: data.linkType,
        linkId: data.linkId,
      },
    });

    // Send push notification
    await pushService.sendPushNotification(data.userId, {
      title: data.title,
      body: data.body,
      data: {
        type: data.type,
        linkType: data.linkType,
        linkId: data.linkId,
      },
    });
  } catch (error) {
    console.error('Failed to create notification:', error);
  }
}
