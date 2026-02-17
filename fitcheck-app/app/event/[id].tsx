import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
  FlatList,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import {
  useEvent,
  useAddEventOutfit,
  useRemoveEventOutfit,
  useCompareEventOutfits,
  useOutfits,
} from '../../src/hooks/useApi';
import type { OutfitCheck, CompareResult, EventOutfitOption } from '../../src/services/api.service';

const DRESS_CODE_LABELS: Record<string, string> = {
  casual: 'Casual',
  smart_casual: 'Smart Casual',
  business_casual: 'Business Casual',
  formal: 'Formal',
  black_tie: 'Black Tie',
};

const EVENT_TYPE_LABELS: Record<string, string> = {
  wedding: 'Wedding',
  job_interview: 'Job Interview',
  date_night: 'Date Night',
  conference: 'Conference',
  party: 'Party',
  vacation: 'Vacation',
  other: 'Other',
};

function formatDate(dateStr: string) {
  return new Date(dateStr).toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
}

function ScoreBadge({ score }: { score: number }) {
  const color = score >= 8 ? Colors.success : score >= 6 ? Colors.warning : '#EF4444';
  return (
    <View style={[styles.scoreBadge, { backgroundColor: color + '22' }]}>
      <Ionicons name="star" size={11} color={color} />
      <Text style={[styles.scoreBadgeText, { color }]}>{score.toFixed(1)}</Text>
    </View>
  );
}

function CompareResults({
  result,
  outfits,
}: {
  result: CompareResult;
  outfits: EventOutfitOption[];
}) {
  const winner = outfits.find((o) => o.outfitCheckId === result.winnerId);

  return (
    <View style={styles.compareCard}>
      <View style={styles.compareHeader}>
        <Ionicons name="sparkles" size={20} color={Colors.primary} />
        <Text style={styles.compareTitle}>AI Verdict</Text>
      </View>

      <Text style={styles.compareSummary}>{result.summary}</Text>

      {/* Winner */}
      <View style={styles.winnerBlock}>
        <View style={styles.winnerBadge}>
          <Ionicons name="trophy" size={14} color="#FFD700" />
          <Text style={styles.winnerBadgeText}>Best Choice</Text>
        </View>
        {winner && (
          <View style={styles.winnerOutfit}>
            {winner.outfitCheck.thumbnailUrl ? (
              <Image source={{ uri: winner.outfitCheck.thumbnailUrl }} style={styles.winnerThumb} />
            ) : (
              <View style={[styles.winnerThumb, styles.thumbPlaceholder]}>
                <Ionicons name="shirt-outline" size={24} color={Colors.textMuted} />
              </View>
            )}
            <Text style={styles.winnerReason}>{result.winnerReason}</Text>
          </View>
        )}
      </View>

      {/* Ranking */}
      {result.rankings.length > 1 && (
        <View style={styles.rankingBlock}>
          <Text style={styles.rankingTitle}>Full Ranking</Text>
          {result.rankings.map((r, i) => {
            const outfit = outfits.find((o) => o.outfitCheckId === r.outfitId);
            return (
              <View key={r.outfitId} style={styles.rankRow}>
                <Text style={styles.rankNumber}>#{r.rank}</Text>
                {outfit?.outfitCheck.thumbnailUrl ? (
                  <Image source={{ uri: outfit.outfitCheck.thumbnailUrl }} style={styles.rankThumb} />
                ) : (
                  <View style={[styles.rankThumb, styles.thumbPlaceholder]}>
                    <Ionicons name="shirt-outline" size={16} color={Colors.textMuted} />
                  </View>
                )}
                <View style={styles.rankInfo}>
                  <View style={styles.rankScoreRow}>
                    <ScoreBadge score={r.score} />
                  </View>
                  <Text style={styles.rankNotes} numberOfLines={2}>{r.notes}</Text>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Styling tip */}
      {result.stylingTip ? (
        <View style={styles.tipBlock}>
          <Ionicons name="bulb-outline" size={16} color={Colors.warning} />
          <Text style={styles.tipText}>{result.stylingTip}</Text>
        </View>
      ) : null}
    </View>
  );
}

export default function EventDetailScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams<{ id: string }>();
  const [showOutfitPicker, setShowOutfitPicker] = useState(false);

  const { data: eventData, isLoading: eventLoading } = useEvent(id);
  const event = eventData?.event;

  const { data: outfitsData, isLoading: outfitsLoading } = useOutfits({ limit: 30 });
  const allOutfits: OutfitCheck[] = (outfitsData as any)?.outfits ?? [];

  const addOutfit = useAddEventOutfit();
  const removeOutfit = useRemoveEventOutfit();
  const compare = useCompareEventOutfits();

  const attachedOutfits: EventOutfitOption[] = event?.outfitOptions ?? [];
  const attachedIds = new Set(attachedOutfits.map((o) => o.outfitCheckId));
  const availableToAdd = allOutfits.filter((o) => !attachedIds.has(o.id));

  const compareResult = event?.compareResult as CompareResult | null;

  function handleAddOutfit(outfit: OutfitCheck) {
    if (!id) return;
    setShowOutfitPicker(false);
    addOutfit.mutate(
      { eventId: id, outfitCheckId: outfit.id },
      {
        onError: (err: any) => {
          Alert.alert('Error', err?.response?.data?.error ?? 'Could not add outfit. Try again.');
        },
      }
    );
  }

  function handleRemoveOutfit(outfitCheckId: string) {
    if (!id) return;
    Alert.alert('Remove Outfit', 'Remove this outfit from the event?', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Remove',
        style: 'destructive',
        onPress: () =>
          removeOutfit.mutate(
            { eventId: id, outfitCheckId },
            { onError: () => Alert.alert('Error', 'Could not remove outfit. Try again.') }
          ),
      },
    ]);
  }

  function handleCompare() {
    if (!id) return;
    if (attachedOutfits.length < 2) {
      Alert.alert('Need more outfits', 'Add at least 2 outfits to get an AI comparison.');
      return;
    }
    compare.mutate(id, {
      onError: (err: any) => {
        Alert.alert('Error', err?.response?.data?.error ?? 'AI comparison failed. Try again.');
      },
    });
  }

  if (eventLoading) {
    return (
      <SafeAreaView style={styles.container}>
        <ActivityIndicator style={styles.loader} color={Colors.primary} />
      </SafeAreaView>
    );
  }

  if (!event) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Event</Text>
          <View style={styles.backButton} />
        </View>
        <View style={styles.emptyState}>
          <Text style={styles.emptyText}>Event not found</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle} numberOfLines={1}>{event.title}</Text>
        <View style={styles.backButton} />
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Event Info Card */}
        <View style={styles.infoCard}>
          <View style={styles.infoRow}>
            <Ionicons name="calendar-outline" size={18} color={Colors.primary} />
            <Text style={styles.infoText}>{formatDate(event.date)}</Text>
          </View>
          {event.type && (
            <View style={styles.infoRow}>
              <Ionicons name="pricetag-outline" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>{EVENT_TYPE_LABELS[event.type] ?? event.type}</Text>
            </View>
          )}
          {event.dressCode && (
            <View style={styles.infoRow}>
              <Ionicons name="shirt-outline" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>{DRESS_CODE_LABELS[event.dressCode] ?? event.dressCode}</Text>
            </View>
          )}
          {event.notes && (
            <View style={styles.infoRow}>
              <Ionicons name="document-text-outline" size={18} color={Colors.primary} />
              <Text style={styles.infoText}>{event.notes}</Text>
            </View>
          )}
        </View>

        {/* Outfit Options */}
        <View style={styles.section}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Outfit Options ({attachedOutfits.length})</Text>
            <TouchableOpacity onPress={() => setShowOutfitPicker(true)}>
              <Text style={styles.addOutfitLink}>+ Add Outfit</Text>
            </TouchableOpacity>
          </View>

          {attachedOutfits.length === 0 ? (
            <View style={styles.outfitsEmpty}>
              <Ionicons name="shirt-outline" size={36} color={Colors.textMuted} />
              <Text style={styles.outfitsEmptyText}>No outfits added yet</Text>
              <TouchableOpacity
                style={styles.addFirstOutfitButton}
                onPress={() => setShowOutfitPicker(true)}
              >
                <Text style={styles.addFirstOutfitText}>Add your first outfit option</Text>
              </TouchableOpacity>
            </View>
          ) : (
            <View style={styles.outfitGrid}>
              {attachedOutfits.map((eo) => {
                const isWinner = compareResult?.winnerId === eo.outfitCheckId;
                return (
                  <TouchableOpacity
                    key={eo.id}
                    style={[styles.outfitCard, isWinner && styles.outfitCardWinner]}
                    activeOpacity={0.8}
                    onLongPress={() => handleRemoveOutfit(eo.outfitCheckId)}
                  >
                    {eo.outfitCheck.thumbnailUrl ? (
                      <Image source={{ uri: eo.outfitCheck.thumbnailUrl }} style={styles.outfitThumb} />
                    ) : (
                      <View style={[styles.outfitThumb, styles.thumbPlaceholder]}>
                        <Ionicons name="shirt-outline" size={28} color={Colors.textMuted} />
                      </View>
                    )}
                    {eo.outfitCheck.aiScore != null && (
                      <View style={styles.outfitScoreOverlay}>
                        <ScoreBadge score={eo.outfitCheck.aiScore} />
                      </View>
                    )}
                    {isWinner && (
                      <View style={styles.winnerOverlay}>
                        <Ionicons name="trophy" size={16} color="#FFD700" />
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {attachedOutfits.length > 0 && (
            <Text style={styles.longPressHint}>Long press an outfit to remove it</Text>
          )}
        </View>

        {/* AI Compare */}
        {attachedOutfits.length >= 2 && (
          <View style={styles.section}>
            <TouchableOpacity
              style={styles.compareButton}
              activeOpacity={0.8}
              onPress={handleCompare}
              disabled={compare.isPending}
            >
              <LinearGradient
                colors={[Colors.primary, '#FF7A6B']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.compareButtonGradient}
              >
                {compare.isPending ? (
                  <>
                    <ActivityIndicator color={Colors.white} />
                    <Text style={styles.compareButtonText}>Analyzing outfits…</Text>
                  </>
                ) : (
                  <>
                    <Ionicons name="sparkles" size={20} color={Colors.white} />
                    <Text style={styles.compareButtonText}>
                      {compareResult ? 'Re-compare with AI' : 'Compare with AI'}
                    </Text>
                  </>
                )}
              </LinearGradient>
            </TouchableOpacity>
          </View>
        )}

        {/* Compare Results */}
        {compareResult && !compare.isPending && (
          <View style={styles.section}>
            <CompareResults result={compareResult} outfits={attachedOutfits} />
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Outfit Picker Modal */}
      <Modal
        visible={showOutfitPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOutfitPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose an Outfit</Text>
            <TouchableOpacity onPress={() => setShowOutfitPicker(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Select from your outfit history</Text>

          {outfitsLoading ? (
            <ActivityIndicator style={styles.loader} color={Colors.primary} />
          ) : availableToAdd.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>
                {allOutfits.length === 0
                  ? 'No outfit history yet. Take a photo first!'
                  : 'All your outfits are already added.'}
              </Text>
            </View>
          ) : (
            <FlatList
              data={availableToAdd}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.pickerGrid}
              columnWrapperStyle={styles.pickerRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.pickerItem}
                  activeOpacity={0.8}
                  onPress={() => handleAddOutfit(item)}
                >
                  {item.thumbnailUrl ? (
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.pickerImage} />
                  ) : (
                    <View style={[styles.pickerImage, styles.thumbPlaceholder]}>
                      <Ionicons name="shirt-outline" size={32} color={Colors.textMuted} />
                    </View>
                  )}
                  {item.aiScore != null && (
                    <View style={styles.pickerScore}>
                      <ScoreBadge score={item.aiScore} />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: { width: 40, height: 40, justifyContent: 'center', alignItems: 'center' },
  headerTitle: {
    flex: 1,
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    textAlign: 'center',
  },
  scrollView: { flex: 1 },
  loader: { marginTop: Spacing.xl * 2 },
  infoCard: {
    margin: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  infoRow: { flexDirection: 'row', alignItems: 'flex-start', gap: Spacing.sm },
  infoText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
  },
  section: { paddingHorizontal: Spacing.md, marginBottom: Spacing.lg },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  addOutfitLink: { fontSize: FontSize.md, fontWeight: '600', color: Colors.primary },
  outfitsEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
  },
  outfitsEmptyText: { fontSize: FontSize.md, color: Colors.textMuted },
  addFirstOutfitButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  addFirstOutfitText: { color: Colors.white, fontWeight: '700', fontSize: FontSize.md },
  outfitGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  outfitCard: {
    width: '30%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
    borderWidth: 2,
    borderColor: 'transparent',
  },
  outfitCardWinner: { borderColor: '#FFD700' },
  outfitThumb: { width: '100%', height: '100%' },
  thumbPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  outfitScoreOverlay: {
    position: 'absolute',
    bottom: 4,
    left: 4,
  },
  winnerOverlay: {
    position: 'absolute',
    top: 4,
    right: 4,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.full,
    padding: 4,
  },
  scoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  scoreBadgeText: { fontSize: 10, fontWeight: '700' },
  longPressHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.sm,
    fontStyle: 'italic',
  },
  compareButton: { borderRadius: BorderRadius.full, overflow: 'hidden' },
  compareButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  compareButtonText: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.white },
  // Compare results card
  compareCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    borderWidth: 1,
    borderColor: Colors.border,
    gap: Spacing.md,
  },
  compareHeader: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  compareTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  compareSummary: {
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  winnerBlock: {
    backgroundColor: '#FFD70011',
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.sm,
    borderWidth: 1,
    borderColor: '#FFD70033',
  },
  winnerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  winnerBadgeText: { fontSize: FontSize.sm, fontWeight: '700', color: '#B8860B' },
  winnerOutfit: { flexDirection: 'row', gap: Spacing.md, alignItems: 'flex-start' },
  winnerThumb: {
    width: 60,
    height: 80,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  winnerReason: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  rankingBlock: { gap: Spacing.sm },
  rankingTitle: { fontSize: FontSize.md, fontWeight: '700', color: Colors.text },
  rankRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
    borderRadius: BorderRadius.md,
    padding: Spacing.sm,
  },
  rankNumber: { fontSize: FontSize.md, fontWeight: '700', color: Colors.textMuted, width: 24 },
  rankThumb: {
    width: 40,
    height: 53,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surface,
  },
  rankInfo: { flex: 1, gap: 2 },
  rankScoreRow: { flexDirection: 'row' },
  rankNotes: { fontSize: FontSize.xs, color: Colors.textMuted, lineHeight: 16 },
  tipBlock: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
    backgroundColor: Colors.warningAlpha10,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
  },
  tipText: { flex: 1, fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.md,
    paddingHorizontal: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  // Modal
  modalContainer: { flex: 1, backgroundColor: Colors.background },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  modalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  pickerGrid: { padding: Spacing.md, gap: Spacing.sm },
  pickerRow: { gap: Spacing.sm },
  pickerItem: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
  },
  pickerImage: { width: '100%', height: '100%' },
  pickerScore: { position: 'absolute', bottom: 4, left: 4 },
});
