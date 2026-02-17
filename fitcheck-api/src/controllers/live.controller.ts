// @ts-nocheck
import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { livekitService } from '../services/livekit.service.js';
import { liveAIService } from '../services/live-ai.service.js';
import { socketService } from '../services/socket.service.js';
import { createNotification } from './notification.controller.js';

// Validation schemas
const CreateSessionSchema = z.object({
  title: z.string().min(1).max(100),
});

const AnalyzeSessionSchema = z.object({
  imageBase64: z.string(),
});

/**
 * Create a new live session
 */
export async function createSession(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const data = CreateSessionSchema.parse(req.body);

    // Only Plus/Pro users can host live sessions
    if (!req.user || req.user.tier === 'free') {
      throw new AppError(403, 'Hosting live sessions requires a Plus or Pro subscription.');
    }

    // Check if user already has an active session
    const existingSession = await prisma.liveSession.findFirst({
      where: {
        hostId: userId,
        status: { in: ['waiting', 'live'] },
      },
    });

    if (existingSession) {
      throw new AppError(400, 'You already have an active live session');
    }

    // Create session
    const session = await prisma.liveSession.create({
      data: {
        hostId: userId,
        title: data.title,
        status: 'waiting',
      },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
    });

    res.status(201).json(session);
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid session data');
    }
    throw error;
  }
}

/**
 * Start a live session
 */
export async function startSession(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const session = await prisma.liveSession.findFirst({
      where: { id, hostId: userId },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            name: true,
            followers: {
              select: { followerId: true },
            },
          },
        },
      },
    });

    if (!session) {
      throw new AppError(404, 'Session not found');
    }

    if (session.status !== 'waiting') {
      throw new AppError(400, 'Session already started or ended');
    }

    // Generate LiveKit room name
    const roomName = `live-${id}`;

    // Create LiveKit room
    await livekitService.createRoom(roomName);

    // Update session status
    const updatedSession = await prisma.liveSession.update({
      where: { id },
      data: {
        status: 'live',
        livekitRoom: roomName,
        startedAt: new Date(),
      },
    });

    // Notify followers
    const followerIds = session.host.followers.map((f) => f.followerId);
    if (followerIds.length > 0) {
      await Promise.all(
        followerIds.map((followerId) =>
          createNotification({
            userId: followerId,
            type: 'live',
            title: `${session.host.username || session.host.name} went live!`,
            body: session.title,
            linkType: 'live_session',
            linkId: id,
          })
        )
      );
    }

    res.json(updatedSession);
  } catch (error) {
    throw error;
  }
}

/**
 * End a live session
 */
export async function endSession(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const session = await prisma.liveSession.findFirst({
      where: { id, hostId: userId },
    });

    if (!session) {
      throw new AppError(404, 'Session not found');
    }

    if (session.status === 'ended') {
      throw new AppError(400, 'Session already ended');
    }

    // Update session status
    await prisma.liveSession.update({
      where: { id },
      data: {
        status: 'ended',
        endedAt: new Date(),
      },
    });

    // Delete LiveKit room
    if (session.livekitRoom) {
      await livekitService.endRoom(session.livekitRoom);
    }

    // Notify viewers via Socket.io
    if (socketService) {
      socketService.endSession(id);
    }

    res.json({ success: true });
  } catch (error) {
    throw error;
  }
}

/**
 * Get active live sessions
 */
export async function getActiveSessions(req: AuthenticatedRequest, res: Response) {
  try {
    const { limit = '20' } = req.query;

    const sessions = await prisma.liveSession.findMany({
      where: { status: 'live' },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
        _count: {
          select: { viewers: true },
        },
      },
      orderBy: { startedAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({ sessions });
  } catch (error) {
    throw error;
  }
}

/**
 * Get session details
 */
export async function getSession(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const session = await prisma.liveSession.findUnique({
      where: { id },
      include: {
        host: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
        _count: {
          select: { viewers: true },
        },
      },
    });

    if (!session) {
      throw new AppError(404, 'Session not found');
    }

    res.json(session);
  } catch (error) {
    throw error;
  }
}

/**
 * Get LiveKit access token for a session
 */
export async function getSessionToken(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    const session = await prisma.liveSession.findUnique({
      where: { id },
    });

    if (!session) {
      throw new AppError(404, 'Session not found');
    }

    if (session.status !== 'live' && session.status !== 'waiting') {
      throw new AppError(400, 'Session is not active');
    }

    if (!session.livekitRoom) {
      throw new AppError(500, 'LiveKit room not initialized');
    }

    // Get user info
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, name: true },
    });

    const participantName = user?.username || user?.name || userId;
    const isHost = session.hostId === userId;

    // Generate token (host can publish, viewers can only subscribe)
    const token = await livekitService.generateToken(
      session.livekitRoom,
      participantName,
      JSON.stringify({ userId, isHost }),
      isHost
    );

    // Track viewer if not host
    if (!isHost) {
      await prisma.liveSessionViewer.upsert({
        where: {
          sessionId_userId: {
            sessionId: id,
            userId,
          },
        },
        create: {
          sessionId: id,
          userId,
        },
        update: {
          leftAt: null, // Re-joining
        },
      });

      // Update total viewers count
      await prisma.liveSession.update({
        where: { id },
        data: {
          totalViewers: { increment: 1 },
        },
      });
    }

    res.json({
      token,
      livekitUrl: livekitService.getLivekitUrl(),
      isHost,
    });
  } catch (error) {
    throw error;
  }
}

/**
 * Get chat messages for a session
 */
export async function getSessionMessages(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;
    const { limit = '50' } = req.query;

    const messages = await prisma.liveChatMessage.findMany({
      where: { sessionId: id },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
      take: parseInt(limit as string),
    });

    res.json({ messages: messages.reverse() });
  } catch (error) {
    throw error;
  }
}

/**
 * Analyze live stream with AI
 */
export async function analyzeSession(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;
    const data = AnalyzeSessionSchema.parse(req.body);

    const session = await prisma.liveSession.findFirst({
      where: { id, hostId: userId },
      include: {
        host: {
          select: { username: true, name: true },
        },
      },
    });

    if (!session) {
      throw new AppError(404, 'Session not found');
    }

    if (session.status !== 'live') {
      throw new AppError(400, 'Session is not live');
    }

    // Run AI analysis
    const feedback = await liveAIService.analyzeLiveOutfit(id, data.imageBase64, {
      title: session.title,
      hostUsername: session.host.username || session.host.name || undefined,
    });

    // Broadcast AI feedback via Socket.io
    if (socketService) {
      socketService.emitAIFeedback(id, {
        content: feedback,
        score: liveAIService.extractScore(feedback),
        timestamp: new Date().toISOString(),
      });
    }

    res.json({ feedback });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid request data');
    }
    throw error;
  }
}
