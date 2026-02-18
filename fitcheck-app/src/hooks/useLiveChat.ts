import { useEffect, useState } from 'react';
import { socketService } from '../services/socket.service';
import { useAuthStore } from '../stores/authStore';
import { liveService, LiveChatMessage } from '../services/live.service';

export function useLiveChat(sessionId: string) {
  const [messages, setMessages] = useState<LiveChatMessage[]>([]);
  const [viewerCount, setViewerCount] = useState(0);
  const [isTyping, setIsTyping] = useState<{ [userId: string]: boolean }>({});
  const [isEnded, setIsEnded] = useState(false);
  const { token } = useAuthStore();

  useEffect(() => {
    if (!token || !sessionId) return;

    // Connect Socket.io
    socketService.connect(token);
    socketService.joinSession(sessionId);

    // Load existing messages
    liveService.getSessionMessages(sessionId).then((data) => {
      setMessages(data.messages);
    });

    // Listen for new messages
    const handleNewMessage = (data: any) => {
      const newMessage: LiveChatMessage = {
        id: `temp-${Date.now()}`,
        sessionId,
        userId: data.userId,
        isAi: false,
        messageType: 'text',
        content: data.message,
        createdAt: data.timestamp,
        user: null, // Will be populated by backend
      };
      setMessages((prev) => [...prev, newMessage]);
    };

    // Listen for viewer count updates
    const handleViewerCount = (data: { count: number }) => {
      setViewerCount(data.count);
    };

    // Listen for AI feedback
    const handleAIFeedback = (data: any) => {
      const aiMessage: LiveChatMessage = {
        id: `ai-${Date.now()}`,
        sessionId,
        userId: null,
        isAi: true,
        messageType: 'ai_feedback',
        content: data.content,
        createdAt: new Date().toISOString(),
        user: null,
      };
      setMessages((prev) => [...prev, aiMessage]);
    };

    // Listen for typing indicators
    const handleTyping = (data: { userId: string; isTyping: boolean }) => {
      setIsTyping((prev) => ({
        ...prev,
        [data.userId]: data.isTyping,
      }));
    };

    // Listen for session end (host ended stream)
    const handleSessionEnded = () => {
      setIsEnded(true);
    };

    socketService.onNewMessage(handleNewMessage);
    socketService.onViewerCount(handleViewerCount);
    socketService.onAIFeedback(handleAIFeedback);
    socketService.onTyping(handleTyping);
    socketService.onSessionEnded(handleSessionEnded);

    return () => {
      socketService.off('new_message', handleNewMessage);
      socketService.off('viewer_count', handleViewerCount);
      socketService.off('ai_feedback', handleAIFeedback);
      socketService.off('typing', handleTyping);
      socketService.off('session_ended', handleSessionEnded);
      socketService.leaveSession(sessionId);
    };
  }, [sessionId, token]);

  const sendMessage = (message: string) => {
    socketService.sendMessage(sessionId, message);
  };

  const setTypingStatus = (isTyping: boolean) => {
    socketService.setTyping(sessionId, isTyping);
  };

  return {
    messages,
    viewerCount,
    isTyping,
    isEnded,
    sendMessage,
    setTypingStatus,
  };
}
