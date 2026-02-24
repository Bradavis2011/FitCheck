import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Colors, Spacing, Fonts } from '../constants/theme';

type Props = {
  title: string;
  icon: string;
  iconColor: string;
  children: React.ReactNode;
  delay?: number;
};

// Editorial section card — section label (11px uppercase DM Sans) + 60px rule divider
export default function FeedbackCard({ title, icon: _icon, iconColor, children, delay = 0 }: Props) {
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
      {/* Editorial section label */}
      <Text style={[styles.sectionLabel, { color: iconColor }]}>{title}</Text>
      {/* 60px editorial rule */}
      <View style={styles.rule} />
      <View style={styles.content}>
        {children}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.white,
    borderRadius: 8,
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.lg,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    marginBottom: 8,
  },
  rule: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginBottom: Spacing.md,
  },
  content: {
    gap: Spacing.md,
  },
});
