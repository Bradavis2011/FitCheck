import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withRepeat, withTiming, withSequence } from 'react-native-reanimated';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { loadingMessages } from '../lib/mockData';

type Props = {
  messages?: string[];
  showEstimatedTime?: boolean;
  estimatedSeconds?: number;
};

export default function LoadingOverlay({
  messages = loadingMessages,
  showEstimatedTime = true,
  estimatedSeconds = 15
}: Props) {
  const [messageIndex, setMessageIndex] = useState(0);
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Spinning ring animation
  const rotation = useSharedValue(0);

  // Pulse animation
  const scale = useSharedValue(1);

  useEffect(() => {
    // Start rotation animation
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000 }),
      -1,
      false
    );

    // Start pulse animation
    scale.value = withRepeat(
      withSequence(
        withTiming(1.05, { duration: 1000 }),
        withTiming(1, { duration: 1000 })
      ),
      -1,
      false
    );
  }, []);

  useEffect(() => {
    const interval = setInterval(() => {
      setMessageIndex((prev) => (prev + 1) % messages.length);
    }, 2000);
    return () => clearInterval(interval);
  }, [messages]);

  useEffect(() => {
    if (!showEstimatedTime) return;
    const timer = setInterval(() => {
      setElapsedSeconds((prev) => prev + 1);
    }, 1000);
    return () => clearInterval(timer);
  }, [showEstimatedTime]);

  const rotationStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));

  const pulseStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const remainingSeconds = Math.max(0, estimatedSeconds - elapsedSeconds);
  const progressPercentage = Math.min(100, (elapsedSeconds / estimatedSeconds) * 100);

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          <View style={styles.spinnerContainer}>
            <Animated.View style={[styles.spinningRing, rotationStyle]} />
            <Animated.View style={pulseStyle}>
              <Ionicons name="sparkles" size={28} color={Colors.primary} />
            </Animated.View>
          </View>
          <Text style={styles.message}>{messages[messageIndex]}</Text>
          {showEstimatedTime && (
            <>
              <View style={styles.progressBarContainer}>
                <View style={[styles.progressBar, { width: `${progressPercentage}%` }]} />
              </View>
              <Text style={styles.timeEstimate}>
                {remainingSeconds > 0
                  ? `About ${remainingSeconds} second${remainingSeconds !== 1 ? 's' : ''} remaining...`
                  : 'Almost there...'
                }
              </Text>
            </>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.8)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.xl,
    alignItems: 'center',
    maxWidth: 280,
    width: '80%',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  spinnerContainer: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
    position: 'relative',
  },
  spinningRing: {
    position: 'absolute',
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 2,
    borderColor: 'rgba(99, 102, 241, 0.3)',
    borderTopColor: Colors.primary,
  },
  message: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    fontWeight: '500',
  },
  progressBarContainer: {
    width: '100%',
    height: 4,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressBar: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  timeEstimate: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontWeight: '500',
  },
});
