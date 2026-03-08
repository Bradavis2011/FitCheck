import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { useRouter } from 'expo-router';
import { Colors, Fonts, Spacing, FontSize, BorderRadius } from '../constants/theme';
import { InsightItem } from '../hooks/useApi';
import { useRespondToEventFollowUp } from '../hooks/useApi';
import { EventFollowUpResponse } from '../services/api.service';

interface InsightCardProps {
  insight: InsightItem;
  onDismiss?: (id: string) => void;
}

const FOLLOW_UP_OPTIONS: { key: EventFollowUpResponse; label: string }[] = [
  { key: 'crushed_it', label: 'Crushed it' },
  { key: 'felt_good', label: 'Felt good' },
  { key: 'meh', label: 'Meh' },
  { key: 'not_great', label: 'Not great' },
];

export default function InsightCard({ insight, onDismiss }: InsightCardProps) {
  const router = useRouter();
  const respond = useRespondToEventFollowUp();

  const handleAction = () => {
    if (insight.actionRoute) {
      router.push(insight.actionRoute as any);
    } else if (onDismiss) {
      onDismiss(insight.id);
    }
  };

  const handleFollowUpResponse = async (response: EventFollowUpResponse) => {
    try {
      const followUpId = insight.metadata.followUpId as string;
      await respond.mutateAsync({ followUpId, response });
    } catch {}
    onDismiss?.(insight.id);
  };

  const sectionLabel = getSectionLabel(insight.type);

  return (
    <View style={styles.card}>
      {/* 11px uppercase section label */}
      <Text style={styles.sectionLabel}>{sectionLabel}</Text>

      {/* 1px coral rule */}
      <View style={styles.rule} />

      {/* Title */}
      <Text style={styles.title}>{insight.title}</Text>

      {/* Body */}
      <Text style={styles.body}>{insight.body}</Text>

      {/* Action area */}
      {insight.type === 'event_followup' ? (
        <View style={styles.responseRow}>
          {FOLLOW_UP_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.key}
              style={styles.responseBtn}
              onPress={() => handleFollowUpResponse(opt.key)}
              disabled={respond.isPending}
              activeOpacity={0.7}
            >
              {respond.isPending ? (
                <ActivityIndicator size="small" color={Colors.primary} />
              ) : (
                <Text style={styles.responseBtnLabel}>{opt.label}</Text>
              )}
            </TouchableOpacity>
          ))}
        </View>
      ) : insight.actionType === 'view' && insight.actionRoute ? (
        <TouchableOpacity style={styles.actionBtn} onPress={handleAction} activeOpacity={0.8}>
          <Text style={styles.actionBtnLabel}>View</Text>
        </TouchableOpacity>
      ) : insight.actionType === 'dismiss' && onDismiss ? (
        <TouchableOpacity onPress={() => onDismiss(insight.id)} activeOpacity={0.7}>
          <Text style={styles.dismissText}>Dismiss</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function getSectionLabel(type: InsightItem['type']): string {
  switch (type) {
    case 'style_narrative': return 'Your AI this week';
    case 'milestone': return 'Achievement';
    case 'event_followup': return 'Event check-in';
    case 'ai_improvement': return 'AI update';
  }
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.borderSolid,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
  },
  rule: {
    height: 1,
    backgroundColor: Colors.primary,
    width: 32,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 24,
  },
  body: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  responseRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.xs,
  },
  responseBtn: {
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: Colors.border,
    borderRadius: BorderRadius.sharp,
    minWidth: 76,
    alignItems: 'center',
  },
  responseBtnLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.text,
  },
  actionBtn: {
    alignSelf: 'flex-start',
    paddingVertical: 8,
    paddingHorizontal: 16,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sharp,
    marginTop: Spacing.xs,
  },
  actionBtnLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  dismissText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    alignSelf: 'flex-start',
    marginTop: Spacing.xs,
  },
});
