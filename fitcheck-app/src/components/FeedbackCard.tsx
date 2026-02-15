import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';

type Props = {
  title: string;
  icon: string;
  iconColor: string;
  children: React.ReactNode;
  delay?: number;
};

export default function FeedbackCard({ title, icon, iconColor, children, delay = 0 }: Props) {
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 400,
      delay,
      useNativeDriver: true,
    }).start();
  }, [delay]);

  return (
    <Animated.View style={[styles.card, { opacity: fadeAnim }]}>
      <View style={[styles.leftBorder, { backgroundColor: iconColor }]} />
      <View style={styles.contentContainer}>
        <View style={styles.header}>
          <Text style={styles.emoji}>{icon}</Text>
          <Text style={styles.title}>{title}</Text>
        </View>
        <View style={styles.content}>
          {children}
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    flexDirection: 'row',
  },
  leftBorder: {
    width: 4,
    alignSelf: 'stretch',
  },
  contentContainer: {
    flex: 1,
    padding: Spacing.md,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: Spacing.md,
  },
  emoji: {
    fontSize: 20,
  },
  title: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  content: {
    gap: Spacing.sm,
  },
});
