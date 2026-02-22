import { useState } from 'react';
import { liveService } from '../services/live.service';

// LiveKit packages removed — live streaming is a future feature.
// This stub preserves the hook's public API without native WebRTC dependencies.

export function useLiveStream(sessionId: string) {
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  const connect = async (_isHost = false) => {
    setIsConnecting(true);
    setError('Live streaming is not yet available.');
    setIsConnecting(false);
  };

  const disconnect = async () => {
    setIsConnected(false);
  };

  return {
    room: null,
    isConnecting,
    isConnected,
    isDisconnected,
    error,
    participants,
    connect,
    disconnect,
  };
}
