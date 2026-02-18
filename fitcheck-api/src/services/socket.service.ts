import { Server as SocketIOServer, Socket } from 'socket.io';
import { Server as HTTPServer } from 'http';
import jwt from 'jsonwebtoken';
import { prisma } from '../utils/prisma.js';

interface SocketUser {
  userId: string;
  socketId: string;
}

interface JWTPayload {
  userId: string;
  email: string;
}

export class SocketService {
  private io: SocketIOServer;
  private connectedUsers: Map<string, SocketUser> = new Map();
  private sessionViewers: Map<string, Set<string>> = new Map(); // sessionId -> Set of userIds

  constructor(httpServer: HTTPServer) {
    this.io = new SocketIOServer(httpServer, {
      cors: {
        origin: process.env.CORS_ORIGIN?.split(',').map(o => o.trim()) || '*',
        credentials: true,
      },
    });

    this.setupMiddleware();
    this.setupEventHandlers();
  }

  private setupMiddleware() {
    // JWT authentication middleware
    this.io.use((socket, next) => {
      const token = socket.handshake.auth.token;

      if (!token) {
        return next(new Error('Authentication error: No token provided'));
      }

      try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET!) as JWTPayload;
        (socket as any).userId = decoded.userId;
        next();
      } catch (error) {
        next(new Error('Authentication error: Invalid token'));
      }
    });
  }

  private setupEventHandlers() {
    this.io.on('connection', (socket: Socket) => {
      const userId = (socket as any).userId;
      console.log(`✅ User ${userId} connected via Socket.io`);

      // Track connected user
      this.connectedUsers.set(userId, { userId, socketId: socket.id });

      // Join live session
      socket.on('join_session', (data: { sessionId: string }) => {
        const { sessionId } = data;
        socket.join(`session:${sessionId}`);

        // Track viewer
        if (!this.sessionViewers.has(sessionId)) {
          this.sessionViewers.set(sessionId, new Set());
        }
        this.sessionViewers.get(sessionId)!.add(userId);

        // Broadcast updated viewer count
        const viewerCount = this.sessionViewers.get(sessionId)?.size || 0;
        this.io.to(`session:${sessionId}`).emit('viewer_count', { count: viewerCount });

        // Update peakViewers if current count exceeds stored peak
        prisma.liveSession.updateMany({
          where: { id: sessionId, peakViewers: { lt: viewerCount } },
          data: { peakViewers: viewerCount },
        }).catch((err) => {
          console.error('[Socket] Failed to update peakViewers:', err);
        });

        console.log(`User ${userId} joined session ${sessionId}`);
      });

      // Leave live session
      socket.on('leave_session', (data: { sessionId: string }) => {
        const { sessionId } = data;
        socket.leave(`session:${sessionId}`);

        // Remove viewer
        this.sessionViewers.get(sessionId)?.delete(userId);

        // Broadcast updated viewer count
        const viewerCount = this.sessionViewers.get(sessionId)?.size || 0;
        this.io.to(`session:${sessionId}`).emit('viewer_count', { count: viewerCount });

        console.log(`User ${userId} left session ${sessionId}`);
      });

      // Send chat message — broadcast and persist to DB
      socket.on('send_message', async (data: { sessionId: string; message: string }) => {
        const { sessionId, message } = data;
        const timestamp = new Date().toISOString();

        // Broadcast immediately so senders see no delay
        this.io.to(`session:${sessionId}`).emit('new_message', {
          userId,
          message,
          timestamp,
        });

        // Persist to DB (fire-and-forget; don't block the socket handler)
        prisma.liveChatMessage.create({
          data: {
            sessionId,
            userId,
            content: message,
            messageType: 'text',
            isAi: false,
          },
        }).catch((err) => {
          console.error('[Socket] Failed to persist chat message:', err);
        });
      });

      // Typing indicator
      socket.on('typing', (data: { sessionId: string; isTyping: boolean }) => {
        const { sessionId, isTyping } = data;
        socket.to(`session:${sessionId}`).emit('typing', { userId, isTyping });
      });

      // Disconnect
      socket.on('disconnect', () => {
        console.log(`❌ User ${userId} disconnected from Socket.io`);
        this.connectedUsers.delete(userId);

        // Remove from all sessions
        this.sessionViewers.forEach((viewers, sessionId) => {
          if (viewers.has(userId)) {
            viewers.delete(userId);
            const viewerCount = viewers.size;
            this.io.to(`session:${sessionId}`).emit('viewer_count', { count: viewerCount });
          }
        });
      });
    });
  }

  // Emit AI feedback to a session
  public emitAIFeedback(sessionId: string, feedback: any) {
    this.io.to(`session:${sessionId}`).emit('ai_feedback', feedback);
  }

  // End a live session (notify all viewers)
  public endSession(sessionId: string) {
    this.io.to(`session:${sessionId}`).emit('session_ended');
    this.sessionViewers.delete(sessionId);
  }

  // Get viewer count for a session
  public getViewerCount(sessionId: string): number {
    return this.sessionViewers.get(sessionId)?.size || 0;
  }

  // Get Socket.io instance (for potential external use)
  public getIO(): SocketIOServer {
    return this.io;
  }
}

export let socketService: SocketService | null = null;

export function initializeSocketService(httpServer: HTTPServer): SocketService {
  socketService = new SocketService(httpServer);
  return socketService;
}
