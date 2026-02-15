import { useEffect, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { VideoView, useParticipant } from '@livekit/react-native';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize } from '../../src/constants/theme';
import { useLiveStream } from '../../src/hooks/useLiveStream';
import { useLiveChat } from '../../src/hooks/useLiveChat';
import { LiveChatOverlay } from '../../src/components/LiveChatOverlay';
import { liveService, LiveSession } from '../../src/services/live.service';

export default function LiveStreamScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const sessionId = params.id as string;

  const [session, setSession] = useState<LiveSession | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isHost, setIsHost] = useState(false);

  const { room, isConnecting, isConnected, error, connect, disconnect } =
    useLiveStream(sessionId);
  const { messages, viewerCount, sendMessage, setTypingStatus } = useLiveChat(sessionId);

  // Get local participant (for host) or remote participant (for viewer)
  const localParticipant = useParticipant(room.localParticipant);
  const remoteParticipants = Array.from(room.remoteParticipants.values());
  const hostParticipant = useParticipant(remoteParticipants[0]);

  useEffect(() => {
    loadSession();
  }, [sessionId]);

  useEffect(() => {
    if (session && session.status === 'live') {
      connect();
    }

    return () => {
      disconnect();
    };
  }, [session]);

  const loadSession = async () => {
    try {
      setIsLoading(true);
      const data = await liveService.getSession(sessionId);
      setSession(data);

      // Check if current user is host
      const tokenData = await liveService.getSessionToken(sessionId);
      setIsHost(tokenData.isHost);
    } catch (error: any) {
      Alert.alert('Error', 'Failed to load live session');
      router.back();
    } finally {
      setIsLoading(false);
    }
  };

  const handleEndStream = () => {
    Alert.alert(
      'End Live Stream',
      'Are you sure you want to end this live stream?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'End Stream',
          style: 'destructive',
          onPress: async () => {
            try {
              await liveService.endSession(sessionId);
              await disconnect();
              router.back();
            } catch (error) {
              Alert.alert('Error', 'Failed to end stream');
            }
          },
        },
      ]
    );
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!session) {
    return null;
  }

  const videoTrack = isHost
    ? localParticipant?.videoTrackPublications?.[0]?.track
    : hostParticipant?.videoTrackPublications?.[0]?.track;

  return (
    <View style={styles.container}>
      {/* Video Stream */}
      {isConnected && videoTrack ? (
        <VideoView style={styles.video} videoTrack={videoTrack} />
      ) : (
        <View style={styles.videoPlaceholder}>
          <ActivityIndicator size="large" color={Colors.white} />
          <Text style={styles.placeholderText}>
            {isConnecting ? 'Connecting...' : 'Waiting for stream...'}
          </Text>
        </View>
      )}

      <SafeAreaView style={styles.overlay} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="close" size={28} color={Colors.white} />
          </TouchableOpacity>

          <View style={styles.headerCenter}>
            <View style={styles.liveIndicator}>
              <View style={styles.liveDot} />
              <Text style={styles.liveText}>LIVE</Text>
            </View>
            <View style={styles.viewerCountBadge}>
              <Ionicons name="eye" size={14} color={Colors.white} />
              <Text style={styles.viewerCountText}>{viewerCount}</Text>
            </View>
          </View>

          {isHost && (
            <TouchableOpacity style={styles.endButton} onPress={handleEndStream}>
              <Text style={styles.endButtonText}>End</Text>
            </TouchableOpacity>
          )}
          {!isHost && <View style={{ width: 60 }} />}
        </View>

        {/* Stream Info */}
        <View style={styles.infoSection}>
          <Text style={styles.hostName}>@{session.host.username || session.host.name}</Text>
          <Text style={styles.streamTitle}>{session.title}</Text>
        </View>
      </SafeAreaView>

      {/* Chat Overlay */}
      <LiveChatOverlay
        messages={messages}
        onSendMessage={sendMessage}
        onTyping={setTypingStatus}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.black,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.black,
  },
  video: {
    ...StyleSheet.absoluteFillObject,
  },
  videoPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.black,
  },
  placeholderText: {
    fontSize: FontSize.md,
    color: Colors.white,
    marginTop: Spacing.md,
  },
  overlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    pointerEvents: 'box-none',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerCenter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  liveIndicator: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
  },
  liveDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: Colors.white,
  },
  liveText: {
    fontSize: FontSize.xs,
    fontWeight: '700',
    color: Colors.white,
  },
  viewerCountBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: 999,
  },
  viewerCountText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.white,
  },
  endButton: {
    backgroundColor: Colors.error,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: 999,
  },
  endButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  infoSection: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.sm,
  },
  hostName: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
  },
  streamTitle: {
    fontSize: FontSize.md,
    color: Colors.white,
    textShadowColor: 'rgba(0, 0, 0, 0.75)',
    textShadowOffset: { width: 0, height: 1 },
    textShadowRadius: 3,
    marginTop: 2,
  },
});
