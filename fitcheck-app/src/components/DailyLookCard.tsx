import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Fonts, FontSize } from '../constants/theme';
import { useDailyLook } from '../hooks/useApi';
import { useSubscriptionStore } from '../stores/subscriptionStore';

export default function DailyLookCard() {
  const router = useRouter();
  const { tier } = useSubscriptionStore();
  const isPaid = tier === 'plus' || tier === 'pro';

  const { data, isLoading } = useDailyLook(isPaid);

  // Free tier — show teaser card
  if (!isPaid) {
    return (
      <View style={styles.container}>
        <Text style={styles.sectionLabel}>Today's Look</Text>
        <View style={styles.rule} />
        <Text style={styles.headline}>Noa picks your outfit every morning from your actual wardrobe.</Text>
        <TouchableOpacity onPress={() => router.push('/upgrade' as any)} activeOpacity={0.7}>
          <Text style={styles.askLink}>Unlock with Plus →</Text>
        </TouchableOpacity>
      </View>
    );
  }

  if (isLoading) return null;

  if (!data?.available) {
    if (data?.reason === 'insufficient_wardrobe') return null;
    return null;
  }

  const { suggestion, weather } = data;
  if (!suggestion) return null;

  const weatherText =
    weather?.condition && weather?.tempFahrenheit
      ? `${weather.condition} · ${weather.tempFahrenheit}°F`
      : null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Today's Look</Text>
      <View style={styles.rule} />

      {suggestion.reasoning && (
        <Text style={styles.headline}>{suggestion.reasoning}</Text>
      )}

      {weatherText && (
        <Text style={styles.weatherText}>{weatherText}</Text>
      )}

      {suggestion.items.length > 0 && (
        <View style={styles.itemChips}>
          {suggestion.items.map((item, i) => (
            <View key={i} style={styles.itemChip}>
              <Text style={styles.itemChipText}>{item.name.toUpperCase()}</Text>
            </View>
          ))}
        </View>
      )}

      {suggestion.styleNotes?.length > 0 && (
        <Text style={styles.styleNote}>{suggestion.styleNotes[0]}</Text>
      )}

      <View style={styles.actions}>
        <TouchableOpacity
          onPress={() => router.push('/stylist-chat' as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.askLink}>Ask Noa about this →</Text>
        </TouchableOpacity>
      </View>
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
  headline: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Colors.text,
    lineHeight: 28,
    marginBottom: Spacing.sm,
  },
  weatherText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  itemChips: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  itemChip: {
    borderWidth: 1,
    borderColor: Colors.border,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderRadius: 0,
  },
  itemChipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.text,
  },
  styleNote: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    lineHeight: 20,
    marginBottom: Spacing.md,
  },
  actions: {
    flexDirection: 'row',
    gap: Spacing.lg,
  },
  askLink: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
});
