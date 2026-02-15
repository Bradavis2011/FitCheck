import { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated } from 'react-native';
import { Colors, BorderRadius, Spacing } from '../constants/theme';

interface SkeletonLoaderProps {
  width?: number | string;
  height?: number;
  borderRadius?: number;
  style?: any;
}

export function SkeletonLoader({
  width = '100%',
  height = 20,
  borderRadius = BorderRadius.md,
  style
}: SkeletonLoaderProps) {
  const pulseAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    const pulse = Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1000,
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 0,
          duration: 1000,
          useNativeDriver: true,
        }),
      ])
    );
    pulse.start();
    return () => pulse.stop();
  }, []);

  const opacity = pulseAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0.3, 0.7],
  });

  return (
    <Animated.View
      style={[
        styles.skeleton,
        { width, height, borderRadius, opacity },
        style,
      ]}
    />
  );
}

export function OutfitCardSkeleton() {
  return (
    <View style={styles.card}>
      <SkeletonLoader width="100%" height={200} borderRadius={BorderRadius.lg} />
    </View>
  );
}

export function HistoryGridSkeleton({ count = 6 }: { count?: number }) {
  return (
    <View style={styles.grid}>
      {Array.from({ length: count }).map((_, i) => (
        <OutfitCardSkeleton key={i} />
      ))}
    </View>
  );
}

export function FeedbackSkeleton() {
  return (
    <View style={styles.feedbackContainer}>
      <SkeletonLoader width="80%" height={32} style={styles.mb12} />
      <SkeletonLoader width="60%" height={24} style={styles.mb24} />

      <View style={styles.section}>
        <SkeletonLoader width="40%" height={20} style={styles.mb12} />
        <SkeletonLoader width="100%" height={60} borderRadius={BorderRadius.md} style={styles.mb8} />
        <SkeletonLoader width="100%" height={60} borderRadius={BorderRadius.md} style={styles.mb8} />
      </View>

      <View style={styles.section}>
        <SkeletonLoader width="40%" height={20} style={styles.mb12} />
        <SkeletonLoader width="100%" height={60} borderRadius={BorderRadius.md} style={styles.mb8} />
        <SkeletonLoader width="100%" height={60} borderRadius={BorderRadius.md} />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  skeleton: {
    backgroundColor: Colors.surfaceLight,
  },
  card: {
    aspectRatio: 3 / 4,
    marginBottom: Spacing.sm,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    padding: Spacing.md,
  },
  feedbackContainer: {
    padding: Spacing.lg,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  mb8: {
    marginBottom: 8,
  },
  mb12: {
    marginBottom: 12,
  },
  mb24: {
    marginBottom: 24,
  },
});
