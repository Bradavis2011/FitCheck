import { View, Text, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Colors, Spacing, Fonts } from '../constants/theme';
import type { RevisionNote } from '../services/api.service';

interface Props {
  revisionNotes: RevisionNote[];
  originalAdvice: string[]; // couldImprove + takeItFurther from original
  originalOutfitId: string;
}

const STATUS_CONFIG: Record<
  RevisionNote['status'],
  { icon: string; color: string; label: string }
> = {
  implemented: { icon: 'checkmark-circle', color: Colors.success, label: 'Done' },
  partial: { icon: 'remove-circle', color: Colors.warning, label: 'Partial' },
  not_addressed: { icon: 'close-circle', color: Colors.textMuted, label: 'Not yet' },
};

export default function RevisionNotesCard({
  revisionNotes,
  originalAdvice,
  originalOutfitId,
}: Props) {
  const router = useRouter();

  if (!revisionNotes || revisionNotes.length === 0) return null;

  return (
    <View style={styles.card}>
      <Text style={styles.sectionLabel}>REVISION REPORT</Text>
      <View style={styles.rule} />

      {revisionNotes.map((note, i) => {
        const config = STATUS_CONFIG[note.status] ?? STATUS_CONFIG.not_addressed;
        const advice = originalAdvice[note.adviceIndex] ?? `Advice ${note.adviceIndex + 1}`;
        return (
          <View key={i} style={styles.noteRow}>
            <Ionicons
              name={config.icon as any}
              size={18}
              color={config.color}
              style={styles.noteIcon}
            />
            <View style={styles.noteContent}>
              <Text style={styles.noteAdvice} numberOfLines={2}>
                {advice}
              </Text>
              <View style={styles.statusRow}>
                <View style={[styles.statusBadge, { borderColor: config.color }]}>
                  <Text style={[styles.statusLabel, { color: config.color }]}>
                    {config.label}
                  </Text>
                </View>
                <Text style={styles.noteObservation}>{note.observation}</Text>
              </View>
            </View>
          </View>
        );
      })}

      <TouchableOpacity
        style={styles.viewOriginalRow}
        onPress={() => router.push(`/feedback?outfitId=${originalOutfitId}` as any)}
        activeOpacity={0.7}
      >
        <Text style={styles.viewOriginalText}>View Original</Text>
        <Ionicons name="arrow-forward" size={14} color={Colors.primary} />
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 0,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  rule: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginBottom: Spacing.md,
  },
  noteRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    paddingVertical: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  noteIcon: {
    marginTop: 2,
  },
  noteContent: {
    flex: 1,
    gap: 4,
  },
  noteAdvice: {
    fontFamily: Fonts.serif,
    fontSize: 13,
    color: Colors.textSecondary,
    fontStyle: 'italic',
    lineHeight: 18,
  },
  statusRow: {
    flexDirection: 'row',
    alignItems: 'center',
    flexWrap: 'wrap',
    gap: 6,
  },
  statusBadge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderWidth: 1,
    borderRadius: 0,
  },
  statusLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1,
  },
  noteObservation: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.text,
    lineHeight: 18,
  },
  viewOriginalRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: Spacing.md,
    paddingTop: Spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.06)',
  },
  viewOriginalText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: Colors.primary,
  },
});
