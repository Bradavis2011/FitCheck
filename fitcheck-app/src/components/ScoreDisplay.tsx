import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, FontSize, Spacing, getScoreColor } from '../constants/theme';

type Props = {
  score: number;
};

export default function ScoreDisplay({ score }: Props) {
  const [displayScore, setDisplayScore] = useState(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    // Animate scale
    scale.value = withSpring(1, {
      damping: 12,
      stiffness: 100,
    });

    // Count up score
    const duration = 1200;
    const steps = 60;
    const increment = score / steps;
    let current = 0;

    const timer = setInterval(() => {
      current += increment;
      if (current >= score) {
        setDisplayScore(score);
        clearInterval(timer);
      } else {
        setDisplayScore(current);
      }
    }, duration / steps);

    return () => clearInterval(timer);
  }, [score]);

  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const filledStars = Math.round((score / 10) * 5);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.scoreCircle, animatedStyle]}>
        <Text style={styles.score}>{displayScore.toFixed(1)}</Text>
        <Text style={styles.outOf}>/10</Text>
      </Animated.View>
      <View style={styles.stars}>
        {Array.from({ length: 5 }).map((_, i) => (
          <Ionicons
            key={i}
            name="star"
            size={20}
            color={i < filledStars ? Colors.warning : Colors.border}
          />
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.md,
  },
  scoreCircle: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  score: {
    fontSize: 56,
    fontWeight: '700',
    color: Colors.text,
  },
  outOf: {
    fontSize: FontSize.xl,
    color: Colors.textMuted,
    marginLeft: 4,
  },
  stars: {
    flexDirection: 'row',
    gap: 4,
  },
});
