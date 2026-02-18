import { useEffect, useState } from 'react';
import { Room, RoomEvent } from 'livekit-client';
import { liveService } from '../services/live.service';

export function useLiveStream(sessionId: string) {
  const [room] = useState(() => new Room());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [isDisconnected, setIsDisconnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  const connect = async (isHost = false) => {
    try {
      setIsConnecting(true);
      setError(null);

      // Get LiveKit token from backend
      const { token, livekitUrl } = await liveService.getSessionToken(sessionId);

      // Connect to LiveKit room
      await room.connect(livekitUrl, token);

      // Hosts publish camera + mic; viewers subscribe only
      if (isHost) {
        await room.localParticipant.setCameraEnabled(true);
        await room.localParticipant.setMicrophoneEnabled(true);
      }

      setIsConnected(true);
      console.log('[LiveStream] Connected to room');
    } catch (err: any) {
      console.error('[LiveStream] Failed to connect:', err);
      setError(err.message || 'Failed to connect to live stream');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await room.disconnect();
      setIsConnected(false);
      console.log('[LiveStream] Disconnected from room');
    } catch (err) {
      console.error('[LiveStream] Error disconnecting:', err);
    }
  };

  useEffect(() => {
    const handleParticipantConnected = () => {
      setParticipants([...room.remoteParticipants.values()]);
    };

    const handleParticipantDisconnected = () => {
      setParticipants([...room.remoteParticipants.values()]);
    };

    const handleDisconnected = () => {
      setIsConnected(false);
      setIsDisconnected(true);
      console.log('[LiveStream] Room disconnected unexpectedly');
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    room.on(RoomEvent.Disconnected, handleDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
      room.off(RoomEvent.Disconnected, handleDisconnected);
    };
  }, [room]);

  return {
    room,
    isConnecting,
    isConnected,
    isDisconnected,
    error,
    participants,
    connect,
    disconnect,
  };
}
