import api from './api';

export interface LiveSession {
  id: string;
  hostId: string;
  title: string;
  status: 'waiting' | 'live' | 'ended';
  livekitRoom: string | null;
  peakViewers: number;
  totalViewers: number;
  startedAt: string | null;
  endedAt: string | null;
  createdAt: string;
  host: {
    id: string;
    username: string | null;
    name: string | null;
    profileImageUrl: string | null;
  };
  _count?: {
    viewers: number;
  };
}

export interface LiveChatMessage {
  id: string;
  sessionId: string;
  userId: string | null;
  isAi: boolean;
  messageType: 'text' | 'ai_feedback' | 'system';
  content: string;
  createdAt: string;
  user: {
    id: string;
    username: string | null;
    name: string | null;
    profileImageUrl: string | null;
  } | null;
}

export const liveService = {
  async createSession(title: string) {
    const response = await api.post<LiveSession>('/api/live/sessions', { title });
    return response.data;
  },

  async startSession(sessionId: string) {
    const response = await api.post<LiveSession>(`/api/live/sessions/${sessionId}/start`);
    return response.data;
  },

  async endSession(sessionId: string) {
    const response = await api.post<{ success: boolean }>(
      `/api/live/sessions/${sessionId}/end`
    );
    return response.data;
  },

  async getActiveSessions() {
    const response = await api.get<{ sessions: LiveSession[] }>('/api/live/sessions/active');
    return response.data;
  },

  async getSession(sessionId: string) {
    const response = await api.get<LiveSession>(`/api/live/sessions/${sessionId}`);
    return response.data;
  },

  async getSessionToken(sessionId: string) {
    const response = await api.get<{
      token: string;
      livekitUrl: string;
      isHost: boolean;
    }>(`/api/live/sessions/${sessionId}/token`);
    return response.data;
  },

  async getSessionMessages(sessionId: string) {
    const response = await api.get<{ messages: LiveChatMessage[] }>(
      `/api/live/sessions/${sessionId}/messages`
    );
    return response.data;
  },

  async analyzeSession(sessionId: string, imageBase64: string) {
    const response = await api.post<{ feedback: string }>(
      `/api/live/sessions/${sessionId}/analyze`,
      { imageBase64 }
    );
    return response.data;
  },
};
