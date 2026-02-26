import { useEffect, useState } from 'react';
import { View, Text, StyleSheet, Modal } from 'react-native';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withRepeat,
  withTiming,
  withSequence,
  Easing,
} from 'react-native-reanimated';
import { Colors, Spacing, BorderRadius, Fonts } from '../constants/theme';

const STAGES = [
  { label: 'SCANNING', description: 'Reading your look' },
  { label: 'COLOUR', description: 'Checking colour harmony' },
  { label: 'SILHOUETTE', description: 'Evaluating proportion' },
  { label: 'STYLING', description: 'Refining the details' },
  { label: 'RESULTS', description: 'Preparing your report' },
];

type Props = {
  messages?: string[];
  showEstimatedTime?: boolean;
  estimatedSeconds?: number;
};

export default function LoadingOverlay({
  messages,
  showEstimatedTime,
  estimatedSeconds = 15,
}: Props) {
  const [stageIndex, setStageIndex] = useState(0);
  const [elapsed, setElapsed] = useState(0);

  const rotation = useSharedValue(0);
  const stageFade = useSharedValue(1);

  useEffect(() => {
    rotation.value = withRepeat(
      withTiming(360, { duration: 2000, easing: Easing.linear }),
      -1,
      false,
    );
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setElapsed(s => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  useEffect(() => {
    const next = Math.min(
      STAGES.length - 1,
      Math.floor((elapsed / estimatedSeconds) * STAGES.length),
    );
    if (next !== stageIndex) {
      stageFade.value = withSequence(
        withTiming(0, { duration: 180 }),
        withTiming(1, { duration: 280 }),
      );
      setStageIndex(next);
    }
  }, [elapsed]);

  const progress = Math.min(100, (elapsed / estimatedSeconds) * 100);

  const ringStyle = useAnimatedStyle(() => ({
    transform: [{ rotate: `${rotation.value}deg` }],
  }));
  const fadeStyle = useAnimatedStyle(() => ({ opacity: stageFade.value }));

  return (
    <Modal visible transparent animationType="fade">
      <View style={styles.backdrop}>
        <View style={styles.card}>
          {/* Brand mark: coral spinning ring + italic ? */}
          <View style={styles.markContainer}>
            <Animated.View style={[styles.ring, ringStyle]} />
            <Text style={styles.questionMark}>?</Text>
          </View>

          {/* Stage section label */}
          <Text style={styles.stageLabel}>{STAGES[stageIndex].label}</Text>

          {/* Stage description — fades on stage change */}
          <Animated.Text style={[styles.stageDescription, fadeStyle]}>
            {STAGES[stageIndex].description}
          </Animated.Text>

          {/* Progress bar — editorial sharp edges */}
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, { width: `${progress}%` as any }]} />
          </View>

          {/* Stage dots */}
          <View style={styles.stageDots}>
            {STAGES.map((_, i) => (
              <View
                key={i}
                style={[styles.stageDot, i <= stageIndex && styles.stageDotActive]}
              />
            ))}
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(251, 247, 244, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    paddingVertical: Spacing.xl,
    paddingHorizontal: Spacing.xl,
    alignItems: 'center',
    maxWidth: 300,
    width: '82%',
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.sm,
  },
  markContainer: {
    width: 72,
    height: 72,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.xs,
    position: 'relative',
  },
  ring: {
    position: 'absolute',
    width: 72,
    height: 72,
    borderRadius: 36,
    borderWidth: 1.5,
    borderColor: Colors.primaryAlpha30,
    borderTopColor: Colors.primary,
  },
  questionMark: {
    fontFamily: Fonts.serifItalic,
    fontSize: 32,
    color: Colors.primary,
    lineHeight: 36,
  },
  stageLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2.2,
    color: Colors.textMuted,
    textTransform: 'uppercase',
    marginTop: Spacing.xs,
  },
  stageDescription: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Colors.text,
    textAlign: 'center',
    lineHeight: 26,
  },
  progressTrack: {
    width: '100%',
    height: 2,
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: BorderRadius.sharp,
    marginTop: Spacing.md,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sharp,
  },
  stageDots: {
    flexDirection: 'row',
    gap: 6,
    marginTop: Spacing.sm,
  },
  stageDot: {
    width: 5,
    height: 5,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
  },
  stageDotActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
});
