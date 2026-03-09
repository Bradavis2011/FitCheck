import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Fonts, FontSize } from '../constants/theme';
import { useInsights } from '../hooks/useApi';
import { useSubscriptionStore } from '../stores/subscriptionStore';

const JOURNAL_TYPES = ['WARDROBE SNAPSHOT', 'COLOR STORY', 'STYLE PATTERNS', 'OCCASION GUIDE', 'WHAT WORKS'];

export default function StyleJournalPreviewCard() {
  const router = useRouter();
  const { tier } = useSubscriptionStore();
  const isPaid = tier === 'plus' || tier === 'pro';
  const { data } = useInsights(1);
  const hasInsights = (data?.insights?.length ?? 0) > 0;

  if (!isPaid && !hasInsights) {
    // Free tier teaser
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Editorial</Text>
        <View style={styles.rule} />
        <Text style={styles.title}>Your Style Journal</Text>
        <Text style={styles.subtitle}>
          5 personalized articles about your wardrobe, colors, and style patterns.
        </Text>
        <View style={styles.chips}>
          {JOURNAL_TYPES.slice(0, 2).map((type) => (
            <View key={type} style={styles.lockedChip}>
              <Ionicons name="lock-closed-outline" size={10} color={Colors.textMuted} />
              <Text style={styles.lockedChipText}>{type}</Text>
            </View>
          ))}
        </View>
        <TouchableOpacity onPress={() => router.push('/upgrade' as any)} activeOpacity={0.7}>
          <Text style={styles.link}>Upgrade to unlock →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Editorial</Text>
      <View style={styles.rule} />
      <Text style={styles.title}>Your Style Journal</Text>
      <Text style={styles.subtitle}>
        5 personalized articles about your wardrobe, colors, and style patterns.
      </Text>
      <View style={styles.chips}>
        {JOURNAL_TYPES.map((type) => (
          <View key={type} style={styles.chip}>
            <Text style={styles.chipText}>{type}</Text>
          </View>
        ))}
      </View>
      <TouchableOpacity onPress={() => router.push('/style-journal' as any)} activeOpacity={0.7}>
        <Text style={styles.link}>Read your journal →</Text>
      </TouchableOpacity>
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
  title: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  subtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  chips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  chip: {
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.text,
  },
  lockedChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
  },
  lockedChipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.textMuted,
  },
  link: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
});
