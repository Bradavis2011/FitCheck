import { io, Socket } from 'socket.io-client';
import { API_BASE_URL } from './api';

class SocketService {
  private socket: Socket | null = null;
  private token: string | null = null;

  connect(token: string) {
    if (this.socket?.connected) {
      return this.socket;
    }

    this.token = token;
    this.socket = io(API_BASE_URL, {
      auth: { token },
      transports: ['websocket'],
    });

    this.socket.on('connect', () => {
      console.log('✅ Socket.io connected');
    });

    this.socket.on('disconnect', () => {
      console.log('❌ Socket.io disconnected');
    });

    this.socket.on('connect_error', (error) => {
      console.error('Socket.io connection error:', error);
    });

    return this.socket;
  }

  disconnect() {
    if (this.socket) {
      this.socket.disconnect();
      this.socket = null;
    }
  }

  joinSession(sessionId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('join_session', { sessionId });
  }

  leaveSession(sessionId: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('leave_session', { sessionId });
  }

  sendMessage(sessionId: string, message: string) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('send_message', { sessionId, message });
  }

  setTyping(sessionId: string, isTyping: boolean) {
    if (!this.socket) {
      throw new Error('Socket not connected');
    }
    this.socket.emit('typing', { sessionId, isTyping });
  }

  onNewMessage(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('new_message', callback);
  }

  onViewerCount(callback: (data: { count: number }) => void) {
    if (!this.socket) return;
    this.socket.on('viewer_count', callback);
  }

  onAIFeedback(callback: (data: any) => void) {
    if (!this.socket) return;
    this.socket.on('ai_feedback', callback);
  }

  onSessionEnded(callback: () => void) {
    if (!this.socket) return;
    this.socket.on('session_ended', callback);
  }

  onTyping(callback: (data: { userId: string; isTyping: boolean }) => void) {
    if (!this.socket) return;
    this.socket.on('typing', callback);
  }

  off(event: string, callback?: any) {
    if (!this.socket) return;
    this.socket.off(event, callback);
  }

  isConnected(): boolean {
    return this.socket?.connected || false;
  }
}

export const socketService = new SocketService();
