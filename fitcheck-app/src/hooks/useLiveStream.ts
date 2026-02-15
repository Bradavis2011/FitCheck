import { useEffect, useState } from 'react';
import { Room, RoomEvent, Track } from '@livekit/react-native';
import { liveService } from '../services/live.service';

export function useLiveStream(sessionId: string) {
  const [room] = useState(() => new Room());
  const [isConnecting, setIsConnecting] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [participants, setParticipants] = useState<any[]>([]);

  const connect = async () => {
    try {
      setIsConnecting(true);
      setError(null);

      // Get LiveKit token from backend
      const { token, livekitUrl } = await liveService.getSessionToken(sessionId);

      // Connect to LiveKit room
      await room.connect(livekitUrl, token, {
        audio: true,
        video: true,
      });

      setIsConnected(true);
      console.log('✅ Connected to LiveKit room');
    } catch (err: any) {
      console.error('Failed to connect to LiveKit:', err);
      setError(err.message || 'Failed to connect to live stream');
    } finally {
      setIsConnecting(false);
    }
  };

  const disconnect = async () => {
    try {
      await room.disconnect();
      setIsConnected(false);
      console.log('✅ Disconnected from LiveKit room');
    } catch (err) {
      console.error('Error disconnecting:', err);
    }
  };

  useEffect(() => {
    // Listen for participant changes
    const handleParticipantConnected = () => {
      setParticipants([...room.remoteParticipants.values()]);
    };

    const handleParticipantDisconnected = () => {
      setParticipants([...room.remoteParticipants.values()]);
    };

    room.on(RoomEvent.ParticipantConnected, handleParticipantConnected);
    room.on(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);

    return () => {
      room.off(RoomEvent.ParticipantConnected, handleParticipantConnected);
      room.off(RoomEvent.ParticipantDisconnected, handleParticipantDisconnected);
    };
  }, [room]);

  return {
    room,
    isConnecting,
    isConnected,
    error,
    participants,
    connect,
    disconnect,
  };
}
