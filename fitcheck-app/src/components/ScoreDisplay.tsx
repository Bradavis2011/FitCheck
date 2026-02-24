import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import Animated, { useSharedValue, useAnimatedStyle, withSpring } from 'react-native-reanimated';
import { Colors, Spacing, Fonts, getScoreColor } from '../constants/theme';

type Props = {
  score: number;
};

export default function ScoreDisplay({ score }: Props) {
  const [displayScore, setDisplayScore] = useState(0);
  const scale = useSharedValue(0);

  useEffect(() => {
    scale.value = withSpring(1, { damping: 12, stiffness: 100 });

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

  const scoreColor = getScoreColor(score);

  return (
    <View style={styles.container}>
      <Animated.View style={[styles.scoreRow, animatedStyle]}>
        <Text style={[styles.score, { color: scoreColor }]}>
          {displayScore.toFixed(1)}
        </Text>
        <Text style={styles.outOf}>/10</Text>
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    gap: Spacing.sm,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  score: {
    fontFamily: Fonts.serif,
    fontSize: 56,
    lineHeight: 62,
  },
  outOf: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    color: Colors.textMuted,
    marginLeft: 4,
  },
});
