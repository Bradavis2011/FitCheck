import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { useUserStats } from '../hooks/useApi';

export default function ProgressWidget() {
  const router = useRouter();
  const { data: stats, isLoading } = useUserStats();

  if (isLoading || !stats) {
    return null;
  }

  const level = stats.level || 1;
  const points = stats.points || 0;
  const xpToNext = stats.xpToNextLevel || 100;
  const currentStreak = stats.currentStreak || 0;

  // Calculate XP progress percentage
  const xpProgress = xpToNext > 0 ? ((points % xpToNext) / xpToNext) * 100 : 100;

  // Level names
  const levelNames: Record<number, string> = {
    1: 'Style Newbie',
    2: 'Fashion Friend',
    3: 'Style Advisor',
    4: 'Outfit Expert',
    5: 'Trusted Reviewer',
    6: 'Style Guru',
    7: 'Fashion Icon',
    8: 'Legend',
  };

  const levelName = levelNames[level] || 'Style Enthusiast';

  return (
    <View style={styles.container}>
      <View style={styles.gradient}>
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.levelBadge}>Level {level}</Text>
            <Text style={styles.levelName}>{levelName}</Text>
          </View>
          {currentStreak > 0 && (
            <View style={styles.streakBadge}>
              <Text style={styles.streakFire}>🔥</Text>
              <Text style={styles.streakText}>{currentStreak}</Text>
            </View>
          )}
        </View>

        {/* XP Progress Bar */}
        <View style={styles.xpSection}>
          <View style={styles.xpBar}>
            <View style={[styles.xpFill, { width: `${xpProgress}%` }]} />
          </View>
          <Text style={styles.xpText}>
            {xpToNext > 0 ? `${xpToNext} XP to Level ${level + 1}` : 'Max Level!'}
          </Text>
        </View>

        {/* CTA Button */}
        <TouchableOpacity
          style={styles.ctaButton}
          onPress={() => router.push('/give-feedback' as any)}
          activeOpacity={0.8}
        >
          <Ionicons name="heart" size={20} color={Colors.primary} />
          <Text style={styles.ctaText}>Give Feedback to Earn Bonus Check</Text>
          <Ionicons name="chevron-forward" size={18} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      {/* Daily Goals Preview */}
      <View style={styles.goalsPreview}>
        <TouchableOpacity
          style={styles.goalsRow}
          onPress={() => router.push('/(tabs)/profile' as any)} // Navigate to full goals view
          activeOpacity={0.7}
        >
          <Text style={styles.goalsTitle}>Today's Goals</Text>
          <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginHorizontal: Spacing.md,
    marginVertical: Spacing.md,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  gradient: {
    padding: Spacing.lg,
    backgroundColor: Colors.primary,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  levelBadge: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: 'rgba(255, 255, 255, 0.9)',
    marginBottom: 2,
  },
  levelName: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.white,
  },
  streakBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
    borderRadius: BorderRadius.full,
  },
  streakFire: {
    fontSize: 18,
  },
  streakText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  xpSection: {
    marginBottom: Spacing.md,
  },
  xpBar: {
    height: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.3)',
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.xs,
  },
  xpFill: {
    height: '100%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
  },
  xpText: {
    fontSize: FontSize.sm,
    color: 'rgba(255, 255, 255, 0.9)',
    fontWeight: '600',
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
  },
  ctaText: {
    flex: 1,
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  goalsPreview: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.white,
  },
  goalsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  goalsTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
});
