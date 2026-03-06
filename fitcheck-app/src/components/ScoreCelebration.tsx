/**
 * ScoreCelebration — Inline visual flourish after score reveal completes.
 * Replaces the Alert.alert high-score prompt.
 *
 * Score ≥8:  Gold shimmer emanating from score area (2s, non-blocking)
 * Score ≥9:  Shimmer + 8 editorial confetti particles
 * Score 10:  Full-screen gold flash + confetti
 *
 * Rendered as an absolute overlay that removes itself after animation.
 * No interaction required — screen recording is not interrupted.
 */

import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import Animated, {
  Easing,
  useAnimatedStyle,
  useSharedValue,
  withDelay,
  withSequence,
  withTiming,
} from 'react-native-reanimated';

type Props = {
  score: number;
  onDone: () => void;
};

// Confetti particle — small square rotating outward from center
function ConfettiParticle({
  angle,
  delay,
  color,
}: {
  angle: number;
  delay: number;
  color: string;
}) {
  const translateX = useSharedValue(0);
  const translateY = useSharedValue(0);
  const opacity = useSharedValue(0);
  const rotate = useSharedValue(0);

  useEffect(() => {
    const dx = Math.cos(angle) * 120;
    const dy = Math.sin(angle) * 160;

    opacity.value = withDelay(delay, withSequence(
      withTiming(1, { duration: 150 }),
      withDelay(700, withTiming(0, { duration: 300 })),
    ));
    translateX.value = withDelay(delay, withTiming(dx, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    translateY.value = withDelay(delay, withTiming(dy, { duration: 1100, easing: Easing.out(Easing.cubic) }));
    rotate.value = withDelay(delay, withTiming(Math.random() * 360, { duration: 1100 }));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const style = useAnimatedStyle(() => ({
    opacity: opacity.value,
    transform: [
      { translateX: translateX.value },
      { translateY: translateY.value },
      { rotate: `${rotate.value}deg` },
    ],
  }));

  return (
    <Animated.View style={[styles.particle, { backgroundColor: color }, style]} />
  );
}

const PARTICLE_COLORS = ['#F59E0B', '#10B981', '#E85D4C', '#FFD700', '#fff', '#F59E0B', '#E85D4C', '#10B981'];

export default function ScoreCelebration({ score, onDone }: Props) {
  const shimmerOpacity = useSharedValue(0);
  const flashOpacity = useSharedValue(0);
  const doneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    // Gold shimmer (all scores ≥8)
    shimmerOpacity.value = withSequence(
      withTiming(0.35, { duration: 200 }),
      withDelay(1200, withTiming(0, { duration: 600 })),
    );

    // Full-screen flash for score 10
    if (score >= 10) {
      flashOpacity.value = withSequence(
        withTiming(0.7, { duration: 80 }),
        withTiming(0, { duration: 500 }),
      );
    }

    // Clean up after 2.5s
    doneTimerRef.current = setTimeout(onDone, 2500);

    return () => {
      if (doneTimerRef.current) clearTimeout(doneTimerRef.current);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const shimmerStyle = useAnimatedStyle(() => ({
    opacity: shimmerOpacity.value,
  }));

  const flashStyle = useAnimatedStyle(() => ({
    opacity: flashOpacity.value,
  }));

  const showConfetti = score >= 9;
  const particleAngles = Array.from({ length: 8 }, (_, i) => (i * Math.PI * 2) / 8);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {/* Gold radial shimmer */}
      <Animated.View style={[StyleSheet.absoluteFill, styles.shimmer, shimmerStyle]} />

      {/* Full flash for score 10 */}
      {score >= 10 && (
        <Animated.View style={[StyleSheet.absoluteFill, styles.flash, flashStyle]} />
      )}

      {/* Confetti particles */}
      {showConfetti && (
        <View style={styles.particleOrigin}>
          {particleAngles.map((angle, i) => (
            <ConfettiParticle
              key={i}
              angle={angle}
              delay={i * 60}
              color={PARTICLE_COLORS[i % PARTICLE_COLORS.length]}
            />
          ))}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  shimmer: {
    backgroundColor: '#F59E0B',
    opacity: 0,
  },
  flash: {
    backgroundColor: '#FFD700',
    opacity: 0,
  },
  particleOrigin: {
    position: 'absolute',
    top: '35%',
    left: '50%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  particle: {
    position: 'absolute',
    width: 8,
    height: 8,
  },
});
