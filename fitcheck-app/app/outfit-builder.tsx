import { useState, useMemo } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  Image,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../src/constants/theme';
import { useWardrobeItems, useWardrobeProgress, useSuggestOutfit, useAnalyzeOutfit } from '../src/hooks/useApi';
import type { WardrobeItem, WardrobeCategory, VirtualOutfitAnalysis } from '../src/services/api.service';

type SlotCategory = WardrobeCategory;

type OutfitSlot = {
  category: SlotCategory;
  label: string;
  icon: string;
  selected: WardrobeItem | null;
};

const SLOT_DEFINITIONS: { category: SlotCategory; label: string; icon: string }[] = [
  { category: 'tops', label: 'Top', icon: 'shirt-outline' },
  { category: 'bottoms', label: 'Bottom', icon: 'body-outline' },
  { category: 'shoes', label: 'Shoes', icon: 'footsteps-outline' },
  { category: 'outerwear', label: 'Layer', icon: 'layers-outline' },
];

const OCCASION_OPTIONS = ['Casual', 'Work', 'Date Night', 'Going Out', 'Event', 'Weekend'];
const WEATHER_OPTIONS = ['Cold', 'Cool', 'Mild', 'Warm', 'Hot'];

export default function OutfitBuilderScreen() {
  const router = useRouter();
  const [slots, setSlots] = useState<OutfitSlot[]>(
    SLOT_DEFINITIONS.map((s) => ({ ...s, selected: null }))
  );
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // Context bar
  const [showContext, setShowContext] = useState(false);
  const [selectedOccasion, setSelectedOccasion] = useState<string | null>(null);
  const [selectedWeather, setSelectedWeather] = useState<string | null>(null);

  // AI suggestion state
  const [missingPieces, setMissingPieces] = useState<string[] | undefined>();
  const [aiReasoning, setAiReasoning] = useState<string | null>(null);

  // Feedback modal state
  const [feedbackModal, setFeedbackModal] = useState<VirtualOutfitAnalysis | null>(null);

  // Load all wardrobe items + progress
  const { data, isLoading } = useWardrobeItems();
  const { data: progress } = useWardrobeProgress();
  const allItems: WardrobeItem[] = data?.items ?? [];
  const outfitCheckCount = progress?.outfitCheckCount ?? 0;
  const canSuggest = outfitCheckCount >= 5;
  const canAnalyze = outfitCheckCount >= 3;

  const suggestOutfit = useSuggestOutfit();
  const analyzeOutfit = useAnalyzeOutfit();

  const itemsByCategory = useMemo(() => {
    const map: Record<SlotCategory, WardrobeItem[]> = {
      tops: [],
      bottoms: [],
      shoes: [],
      accessories: [],
      outerwear: [],
    };
    for (const item of allItems) {
      if (map[item.category]) map[item.category].push(item);
    }
    return map;
  }, [allItems]);

  const availableItems: WardrobeItem[] =
    activeSlot !== null ? itemsByCategory[slots[activeSlot].category] ?? [] : [];

  function handleSlotPress(index: number) {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveSlot(activeSlot === index ? null : index);
  }

  function handleItemSelect(item: WardrobeItem) {
    if (activeSlot === null) return;
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    setSlots((prev) => {
      const next = [...prev];
      next[activeSlot] = { ...next[activeSlot], selected: item };
      return next;
    });
    setActiveSlot(null);
  }

  function handleClearSlot(index: number) {
    setSlots((prev) => {
      const next = [...prev];
      next[index] = { ...next[index], selected: null };
      return next;
    });
  }

  function handleShuffle() {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    setSlots((prev) =>
      prev.map((slot) => {
        const items = itemsByCategory[slot.category];
        if (!items || items.length === 0) return slot;
        const random = items[Math.floor(Math.random() * items.length)];
        return { ...slot, selected: random };
      })
    );
  }

  async function handleAiSuggest() {
    if (!canSuggest) {
      Alert.alert(
        'Not Unlocked Yet',
        `Complete ${5 - outfitCheckCount} more outfit check${5 - outfitCheckCount !== 1 ? 's' : ''} to unlock AI outfit suggestions.`
      );
      return;
    }
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await suggestOutfit.mutateAsync({
        occasion: selectedOccasion ?? undefined,
        weather: selectedWeather ?? undefined,
      });

      if (result.items.length === 0) {
        Alert.alert('Add More Items', result.reasoning || 'Add at least 3 wardrobe items for AI suggestions.');
        return;
      }

      // Map suggestion items back to wardrobe items and populate slots
      const itemMap = new Map(allItems.map((i) => [i.id, i]));
      setSlots((prev) =>
        prev.map((slot) => {
          const suggestion = result.items.find(
            (s) => s.category === slot.category
          );
          if (suggestion) {
            const wardrobeItem = itemMap.get(suggestion.wardrobeItemId);
            if (wardrobeItem) return { ...slot, selected: wardrobeItem };
          }
          return slot;
        })
      );

      setAiReasoning(result.reasoning);
      setMissingPieces(result.missingPieces);
      setActiveSlot(null);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('AI Suggest Failed', err?.message ?? 'Please try again.');
    }
  }

  async function handleCheckOutfit() {
    const filled = slots.filter((s) => s.selected !== null);
    if (filled.length < 2) {
      Alert.alert('Add More Items', 'Select at least 2 items to check your outfit.');
      return;
    }

    if (!canAnalyze) {
      // Under threshold — send them to camera
      Alert.alert(
        'Take a Photo Instead',
        `Complete ${3 - outfitCheckCount} more outfit check${3 - outfitCheckCount !== 1 ? 's' : ''} to unlock virtual analysis. For now, take a photo to get AI feedback!`,
        [
          { text: 'Go to Camera', onPress: () => router.push('/(tabs)' as any) },
          { text: 'Cancel', style: 'cancel' },
        ]
      );
      return;
    }

    const itemIds = filled.map((s) => s.selected!.id);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    try {
      const result = await analyzeOutfit.mutateAsync({
        itemIds,
        occasion: selectedOccasion ?? undefined,
        weather: selectedWeather ?? undefined,
      });
      setFeedbackModal(result);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
    } catch (err: any) {
      Alert.alert('Analysis Failed', err?.message ?? 'Please try again.');
    }
  }

  function handleQuickSwap(swapName: string) {
    // Find item in wardrobe by name (case-insensitive)
    const found = allItems.find((i) => i.name.toLowerCase() === swapName.toLowerCase());
    if (!found) {
      Alert.alert('Item Not Found', `"${swapName}" wasn't found in your wardrobe.`);
      return;
    }
    // Replace the matching category slot
    setSlots((prev) =>
      prev.map((slot) => {
        if (slot.category === found.category) return { ...slot, selected: found };
        return slot;
      })
    );
    setFeedbackModal(null);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
  }

  const filledCount = slots.filter((s) => s.selected !== null).length;

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Build an Outfit</Text>
        <View style={styles.headerActions}>
          {/* AI Suggest */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleAiSuggest}
            disabled={suggestOutfit.isPending}
          >
            {suggestOutfit.isPending ? (
              <ActivityIndicator size="small" color={Colors.primary} />
            ) : (
              <View style={styles.aiSuggestBtn}>
                <Ionicons
                  name={canSuggest ? 'sparkles' : 'lock-closed-outline'}
                  size={16}
                  color={canSuggest ? Colors.primary : Colors.textMuted}
                />
                <Text style={[styles.aiSuggestText, !canSuggest && styles.aiSuggestTextLocked]}>
                  AI
                </Text>
              </View>
            )}
          </TouchableOpacity>
          {/* Shuffle */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={handleShuffle}
            disabled={allItems.length === 0}
          >
            <Ionicons
              name="shuffle"
              size={24}
              color={allItems.length === 0 ? Colors.textMuted : Colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      {/* Collapsible Context Bar */}
      <TouchableOpacity
        style={styles.contextToggle}
        onPress={() => setShowContext((v) => !v)}
        activeOpacity={0.7}
      >
        <Text style={styles.contextToggleText}>
          {selectedOccasion || selectedWeather
            ? [selectedOccasion, selectedWeather].filter(Boolean).join(' · ')
            : 'Add context (occasion, weather)'}
        </Text>
        <Ionicons
          name={showContext ? 'chevron-up' : 'chevron-down'}
          size={14}
          color={Colors.textMuted}
        />
      </TouchableOpacity>

      {showContext && (
        <View style={styles.contextBar}>
          <Text style={styles.contextLabel}>OCCASION</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contextRow}>
            {OCCASION_OPTIONS.map((occ) => (
              <TouchableOpacity
                key={occ}
                style={[styles.contextChip, selectedOccasion === occ && styles.contextChipActive]}
                onPress={() => setSelectedOccasion(selectedOccasion === occ ? null : occ)}
              >
                <Text
                  style={[styles.contextChipText, selectedOccasion === occ && styles.contextChipTextActive]}
                >
                  {occ}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
          <Text style={[styles.contextLabel, { marginTop: 8 }]}>WEATHER</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.contextRow}>
            {WEATHER_OPTIONS.map((w) => (
              <TouchableOpacity
                key={w}
                style={[styles.contextChip, selectedWeather === w && styles.contextChipActive]}
                onPress={() => setSelectedWeather(selectedWeather === w ? null : w)}
              >
                <Text
                  style={[styles.contextChipText, selectedWeather === w && styles.contextChipTextActive]}
                >
                  {w}
                </Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        </View>
      )}

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Loading state */}
        {isLoading && (
          <View style={styles.loadingBanner}>
            <ActivityIndicator color={Colors.primary} size="small" />
            <Text style={styles.loadingText}>Loading your wardrobe…</Text>
          </View>
        )}

        {/* Empty wardrobe state */}
        {!isLoading && allItems.length === 0 && (
          <View style={styles.emptyWardrobe}>
            <Ionicons name="shirt-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyTitle}>Your wardrobe is empty</Text>
            <Text style={styles.emptyText}>
              Add items in My Wardrobe first, then come back to build outfits.
            </Text>
            <TouchableOpacity style={styles.goToWardrobeButton} onPress={() => router.push('/wardrobe' as any)}>
              <Text style={styles.goToWardrobeText}>Go to My Wardrobe</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Outfit Preview Slots */}
        {!isLoading && allItems.length > 0 && (
          <View style={styles.previewSection}>
            <Text style={styles.sectionTitle}>Your Outfit</Text>
            <View style={styles.outfitSlots}>
              {slots.map((slot, index) => (
                <TouchableOpacity
                  key={index}
                  style={[
                    styles.outfitSlot,
                    activeSlot === index && styles.outfitSlotActive,
                    slot.selected && styles.outfitSlotFilled,
                  ]}
                  onPress={() => handleSlotPress(index)}
                  activeOpacity={0.7}
                >
                  {slot.selected ? (
                    <>
                      {slot.selected.imageUrl ? (
                        <Image source={{ uri: slot.selected.imageUrl }} style={styles.slotImage} />
                      ) : (
                        <View style={styles.slotColorBlock}>
                          <Ionicons name={slot.icon as any} size={36} color={Colors.textMuted} />
                          <Text style={styles.slotColorName} numberOfLines={2}>
                            {slot.selected.name}
                          </Text>
                        </View>
                      )}
                      <TouchableOpacity
                        style={styles.clearButton}
                        onPress={() => handleClearSlot(index)}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                      >
                        <Ionicons name="close-circle" size={20} color={Colors.white} />
                      </TouchableOpacity>
                      <View style={styles.slotLabel}>
                        <Text style={styles.slotLabelText} numberOfLines={1}>
                          {slot.selected.name}
                        </Text>
                      </View>
                    </>
                  ) : (
                    <View style={styles.slotPlaceholder}>
                      <Ionicons name={slot.icon as any} size={32} color={Colors.textMuted} />
                      <Text style={styles.slotPlaceholderText}>{slot.label}</Text>
                      {itemsByCategory[slot.category].length === 0 && (
                        <Text style={styles.slotEmptyHint}>No items</Text>
                      )}
                    </View>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* AI reasoning + missing pieces */}
            {aiReasoning && (
              <View style={styles.aiReasoningCard}>
                <View style={styles.aiReasoningHeader}>
                  <Ionicons name="sparkles" size={14} color={Colors.primary} />
                  <Text style={styles.aiReasoningLabel}>AI STYLED</Text>
                </View>
                <Text style={styles.aiReasoningText}>{aiReasoning}</Text>
                {missingPieces && missingPieces.length > 0 && (
                  <>
                    <Text style={styles.missingLabel}>CONSIDER ADDING</Text>
                    {missingPieces.map((piece, i) => (
                      <Text key={i} style={styles.missingItem}>· {piece}</Text>
                    ))}
                  </>
                )}
              </View>
            )}
          </View>
        )}

        {/* Item Selector for active slot */}
        {activeSlot !== null && (
          <View style={styles.selectorSection}>
            <Text style={styles.sectionTitle}>Choose {slots[activeSlot].label}</Text>
            {availableItems.length === 0 ? (
              <View style={styles.selectorEmpty}>
                <Text style={styles.selectorEmptyText}>
                  No {slots[activeSlot].label.toLowerCase()} items in your wardrobe.
                </Text>
                <TouchableOpacity onPress={() => router.push('/wardrobe' as any)}>
                  <Text style={styles.selectorAddLink}>Add items in My Wardrobe →</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <View style={styles.itemGrid}>
                {availableItems.map((item) => (
                  <TouchableOpacity
                    key={item.id}
                    style={[
                      styles.itemCard,
                      slots[activeSlot].selected?.id === item.id && styles.itemCardSelected,
                    ]}
                    onPress={() => handleItemSelect(item)}
                    activeOpacity={0.8}
                  >
                    {item.imageUrl ? (
                      <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                    ) : (
                      <View style={styles.itemPlaceholder}>
                        <Ionicons name={slots[activeSlot].icon as any} size={28} color={Colors.textMuted} />
                      </View>
                    )}
                    <View style={styles.itemInfo}>
                      <Text style={styles.itemName} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {item.color ? (
                        <Text style={styles.itemColor}>{item.color}</Text>
                      ) : null}
                    </View>
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        )}

        {/* Empty tap-to-start state */}
        {!isLoading && allItems.length > 0 && activeSlot === null && slots.every((s) => s.selected === null) && !aiReasoning && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="layers-outline" size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Start Building</Text>
            <Text style={styles.emptyText}>Tap a slot above to choose items, or use AI Suggest</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.checkButton, (filledCount < 2 || analyzeOutfit.isPending) && styles.checkButtonDisabled]}
          onPress={handleCheckOutfit}
          disabled={filledCount < 2 || analyzeOutfit.isPending}
          activeOpacity={0.8}
        >
          {analyzeOutfit.isPending ? (
            <ActivityIndicator size="small" color={Colors.white} />
          ) : (
            <Ionicons
              name={canAnalyze ? 'sparkles' : 'camera-outline'}
              size={20}
              color={filledCount >= 2 ? Colors.white : Colors.textMuted}
            />
          )}
          <Text style={[styles.checkButtonText, filledCount < 2 && styles.checkButtonTextDisabled]}>
            {analyzeOutfit.isPending
              ? 'Analyzing…'
              : canAnalyze
              ? filledCount >= 2
                ? `Check Outfit (${filledCount} pieces)`
                : 'Select at least 2 items'
              : 'Take a Photo Instead'}
          </Text>
        </TouchableOpacity>
      </View>

      {/* Feedback Modal */}
      <Modal
        visible={!!feedbackModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setFeedbackModal(null)}
      >
        {feedbackModal && (
          <SafeAreaView style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <Text style={styles.modalTitle}>Virtual Analysis</Text>
              <TouchableOpacity onPress={() => setFeedbackModal(null)}>
                <Ionicons name="close" size={24} color={Colors.text} />
              </TouchableOpacity>
            </View>
            <ScrollView style={styles.modalScroll} showsVerticalScrollIndicator={false}>
              {/* Score */}
              <View style={styles.scoreRow}>
                <Text style={styles.scoreNumber}>{feedbackModal.overallScore.toFixed(1)}</Text>
                <Text style={styles.scoreLabel}>/10 (text-only)</Text>
              </View>

              <Text style={styles.editorialSummary}>{feedbackModal.editorialSummary}</Text>

              <View style={styles.rule} />

              {/* What's Right */}
              {feedbackModal.whatsRight.length > 0 && (
                <View style={styles.feedbackSection}>
                  <Text style={styles.feedbackSectionLabel}>WHAT'S RIGHT</Text>
                  {feedbackModal.whatsRight.map((point, i) => (
                    <Text key={i} style={styles.feedbackPoint}>· {point}</Text>
                  ))}
                </View>
              )}

              {/* Could Improve */}
              {feedbackModal.couldImprove.length > 0 && (
                <View style={styles.feedbackSection}>
                  <Text style={styles.feedbackSectionLabel}>COULD IMPROVE</Text>
                  {feedbackModal.couldImprove.map((point, i) => (
                    <Text key={i} style={styles.feedbackPoint}>· {point}</Text>
                  ))}
                </View>
              )}

              {/* Quick Swaps */}
              {feedbackModal.quickSwaps.length > 0 && (
                <View style={styles.feedbackSection}>
                  <Text style={styles.feedbackSectionLabel}>QUICK SWAPS</Text>
                  {feedbackModal.quickSwaps.map((swap, i) => (
                    <TouchableOpacity
                      key={i}
                      style={styles.swapCard}
                      onPress={() => handleQuickSwap(swap.swap)}
                      activeOpacity={0.7}
                    >
                      <View style={styles.swapMain}>
                        <Text style={styles.swapFrom} numberOfLines={1}>{swap.current}</Text>
                        <Ionicons name="arrow-forward" size={16} color={Colors.primary} />
                        <Text style={styles.swapTo} numberOfLines={1}>{swap.swap}</Text>
                      </View>
                      <Text style={styles.swapReason}>{swap.reason}</Text>
                      <Text style={styles.swapCta}>TAP TO APPLY SWAP</Text>
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {/* Disclaimer */}
              <Text style={styles.disclaimer}>
                📸 Take a photo for a precise visual analysis with an accurate score.
              </Text>

              <View style={{ height: 40 }} />
            </ScrollView>
          </SafeAreaView>
        )}
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    color: Colors.text,
  },
  aiSuggestBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 3,
  },
  aiSuggestText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.2,
    color: Colors.primary,
  },
  aiSuggestTextLocked: {
    color: Colors.textMuted,
  },
  contextToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
    backgroundColor: Colors.surface,
  },
  contextToggleText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  contextBar: {
    backgroundColor: Colors.surface,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  contextLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.textMuted,
    marginBottom: 6,
    marginTop: 10,
  },
  contextRow: {
    flexDirection: 'row',
  },
  contextChip: {
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.15)',
    paddingHorizontal: 12,
    paddingVertical: 5,
    marginRight: 6,
    borderRadius: 0,
  },
  contextChipActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primary,
  },
  contextChipText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  contextChipTextActive: {
    color: Colors.white,
  },
  scrollView: {
    flex: 1,
  },
  loadingBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    justifyContent: 'center',
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  emptyWardrobe: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 3,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  goToWardrobeButton: {
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: 0,
    marginTop: Spacing.sm,
  },
  goToWardrobeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  previewSection: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontFamily: Fonts.sansBold,
    fontSize: FontSize.lg,
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  outfitSlots: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  outfitSlot: {
    width: '48%',
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    backgroundColor: Colors.surface,
    borderWidth: 2,
    borderColor: Colors.border,
    borderStyle: 'dashed',
  },
  outfitSlotActive: {
    borderColor: Colors.primary,
    borderStyle: 'solid',
  },
  outfitSlotFilled: {
    borderStyle: 'solid',
    borderColor: Colors.border,
  },
  slotImage: {
    width: '100%',
    height: '100%',
  },
  slotColorBlock: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
    padding: Spacing.sm,
    backgroundColor: Colors.surfaceLight,
  },
  slotColorName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.xs,
    color: Colors.text,
    textAlign: 'center',
  },
  slotPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  slotPlaceholderText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  slotEmptyHint: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  slotLabel: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    backgroundColor: 'rgba(0,0,0,0.7)',
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
  },
  slotLabelText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.xs,
    color: Colors.white,
    textAlign: 'center',
  },
  clearButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: 0,
  },
  aiReasoningCard: {
    marginTop: Spacing.md,
    backgroundColor: 'rgba(232,93,76,0.06)',
    borderLeftWidth: 2,
    borderLeftColor: Colors.primary,
    padding: Spacing.md,
    gap: 4,
  },
  aiReasoningHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 4,
  },
  aiReasoningLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.primary,
  },
  aiReasoningText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 20,
  },
  missingLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.5,
    color: Colors.textMuted,
    marginTop: 8,
  },
  missingItem: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  selectorSection: {
    padding: Spacing.lg,
    paddingTop: 0,
  },
  selectorEmpty: {
    alignItems: 'center',
    paddingVertical: Spacing.xl,
    gap: Spacing.sm,
  },
  selectorEmptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  selectorAddLink: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.md,
    color: Colors.primary,
  },
  itemGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
  },
  itemCard: {
    width: '31%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemCardSelected: {
    borderColor: Colors.primary,
    borderWidth: 2,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.surfaceLight,
  },
  itemPlaceholder: {
    width: '100%',
    aspectRatio: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
  },
  itemInfo: {
    padding: Spacing.xs,
  },
  itemName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  itemColor: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: 0,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.lg,
  },
  footer: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  checkButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
    backgroundColor: Colors.primary,
    borderRadius: 0,
  },
  checkButtonDisabled: {
    opacity: 0.6,
    backgroundColor: Colors.surface,
  },
  checkButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  checkButtonTextDisabled: {
    color: Colors.textMuted,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.xl,
    color: Colors.text,
  },
  modalScroll: {
    flex: 1,
    padding: Spacing.lg,
  },
  scoreRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 4,
    marginBottom: Spacing.md,
  },
  scoreNumber: {
    fontFamily: Fonts.serifItalic,
    fontSize: 56,
    color: Colors.primary,
    lineHeight: 60,
  },
  scoreLabel: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  editorialSummary: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 24,
    marginBottom: Spacing.lg,
  },
  rule: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginBottom: Spacing.lg,
  },
  feedbackSection: {
    marginBottom: Spacing.lg,
  },
  feedbackSectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  feedbackPoint: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.text,
    lineHeight: 22,
    marginBottom: 4,
  },
  swapCard: {
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: Colors.border,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    gap: 4,
  },
  swapMain: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  swapFrom: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    flex: 1,
    textDecorationLine: 'line-through',
  },
  swapTo: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: FontSize.sm,
    color: Colors.primary,
    flex: 1,
  },
  swapReason: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 18,
  },
  swapCta: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    letterSpacing: 1.2,
    color: Colors.primary,
    marginTop: 4,
  },
  disclaimer: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 18,
    marginTop: Spacing.md,
  },
});
