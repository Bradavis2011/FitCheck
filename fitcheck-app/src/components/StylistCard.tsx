import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Fonts, FontSize } from '../constants/theme';
import { useHomeContext } from '../hooks/useApi';

export default function StylistCard() {
  const router = useRouter();
  const { data, isLoading } = useHomeContext();

  const hasData = !isLoading && !!data;
  const { agentActivity, latestNarrative } = data ?? {};
  const improvementsMade = agentActivity?.improvementsMade ?? 0;
  const hasContent = hasData && (!!latestNarrative || improvementsMade > 0);

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Your Stylist</Text>
      <View style={styles.rule} />

      {hasContent ? (
        <>
          {improvementsMade > 0 && (
            <View style={styles.activityRow}>
              <View style={styles.dot} />
              <Text style={styles.activityText}>
                {improvementsMade} improvement{improvementsMade !== 1 ? 's' : ''} this week
              </Text>
            </View>
          )}

          {latestNarrative && (
            <>
              <Text style={styles.narrative}>"{latestNarrative.text}"</Text>
              <Text style={styles.attribution}>— Noa</Text>
            </>
          )}

          <View style={styles.links}>
            <TouchableOpacity
              onPress={() => router.push('/insights' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.link}>View insights →</Text>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={() => router.push('/stylist-chat' as any)}
              activeOpacity={0.7}
            >
              <Text style={styles.link}>Ask Noa →</Text>
            </TouchableOpacity>
          </View>
        </>
      ) : (
        <>
          <Text style={styles.intro}>
            Noa is your AI stylist. She knows your wardrobe, your weather, and your patterns.
          </Text>
          <TouchableOpacity
            onPress={() => router.push('/stylist-chat' as any)}
            activeOpacity={0.7}
          >
            <Text style={styles.link}>Ask Noa →</Text>
          </TouchableOpacity>
        </>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    marginBottom: Spacing.xl,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  rule: {
    width: 60,
    height: 1,
    backgroundColor: Colors.primary,
    marginBottom: Spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  activityText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  narrative: {
    fontFamily: Fonts.serif,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: Spacing.xs,
    fontStyle: 'italic',
  },
  attribution: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.primary,
    textAlign: 'right',
    marginBottom: Spacing.md,
  },
  links: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  link: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
  intro: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
});
