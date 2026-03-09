import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Fonts, FontSize } from '../constants/theme';
import { useHomeContext } from '../hooks/useApi';

function formatEventDate(isoDate: string): string {
  const d = new Date(isoDate);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffDays = Math.ceil(diffMs / (1000 * 60 * 60 * 24));

  if (diffDays === 0) return 'Today';
  if (diffDays === 1) return 'Tomorrow';
  if (diffDays < 7)
    return d.toLocaleDateString('en-US', { weekday: 'long' });
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
}

function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1).replace(/_/g, ' ');
}

export default function EventCountdownCard() {
  const router = useRouter();
  const { data } = useHomeContext();

  const upcomingEvents = data?.upcomingEvents;
  if (!upcomingEvents || upcomingEvents.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Coming Up</Text>
      <View style={styles.rule} />

      {upcomingEvents.map((event, idx) => {
        const prePopulated = encodeURIComponent(
          `I have a ${event.occasion} coming up on ${formatEventDate(event.eventDate)}${event.setting ? ` (${event.setting})` : ''}. What should I wear?`
        );
        return (
          <View key={idx} style={[styles.eventRow, idx > 0 && styles.eventRowBorder]}>
            <View style={styles.eventMeta}>
              <Text style={styles.eventName}>{capitalize(event.occasion)}</Text>
              <Text style={styles.eventDate}>{formatEventDate(event.eventDate)}</Text>
            </View>
            <TouchableOpacity
              onPress={() =>
                router.push(
                  `/stylist-chat?initialMessage=${prePopulated}` as any
                )
              }
              activeOpacity={0.7}
            >
              <Text style={styles.planLink}>Plan with Noa →</Text>
            </TouchableOpacity>
          </View>
        );
      })}
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
  eventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.sm,
  },
  eventRowBorder: {
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  eventMeta: {
    flex: 1,
  },
  eventName: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  eventDate: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  planLink: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.primary,
  },
});
