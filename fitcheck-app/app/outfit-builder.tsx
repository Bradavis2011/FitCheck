import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useWardrobeItems } from '../src/hooks/useApi';
import type { WardrobeItem, WardrobeCategory } from '../src/services/api.service';

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

export default function OutfitBuilderScreen() {
  const router = useRouter();
  const [slots, setSlots] = useState<OutfitSlot[]>(
    SLOT_DEFINITIONS.map((s) => ({ ...s, selected: null }))
  );
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  // Load all wardrobe items at once — group by category in-component
  const { data, isLoading } = useWardrobeItems();
  const allItems: WardrobeItem[] = data?.items ?? [];

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

  function handleCheckOutfit() {
    const filled = slots.filter((s) => s.selected !== null);
    if (filled.length < 2) {
      Alert.alert('Add More Items', 'Select at least 2 items to check your outfit.');
      return;
    }
    // Navigate to camera/context with wardrobe mode
    // For now, navigate to the main camera tab and let them know
    Alert.alert(
      'Outfit Ready',
      'Take a photo wearing these pieces, then use the camera to get AI feedback!',
      [
        { text: 'Go to Camera', onPress: () => router.push('/(tabs)' as any) },
        { text: 'OK', style: 'cancel' },
      ]
    );
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
        {!isLoading && allItems.length > 0 && activeSlot === null && slots.every((s) => s.selected === null) && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="layers-outline" size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Start Building</Text>
            <Text style={styles.emptyText}>Tap a slot above to choose items</Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Check Outfit Footer */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[styles.checkButton, filledCount < 2 && styles.checkButtonDisabled]}
          onPress={handleCheckOutfit}
          disabled={filledCount < 2}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={filledCount >= 2 ? [Colors.primary, Colors.secondary] : [Colors.surface, Colors.surface]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkButtonGradient}
          >
            <Ionicons
              name="sparkles"
              size={20}
              color={filledCount >= 2 ? Colors.white : Colors.textMuted}
            />
            <Text style={[styles.checkButtonText, filledCount < 2 && styles.checkButtonTextDisabled]}>
              {filledCount >= 2 ? `Check Outfit (${filledCount} pieces)` : 'Select at least 2 items'}
            </Text>
          </LinearGradient>
        </TouchableOpacity>
      </View>
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
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
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
    fontSize: FontSize.xl,
    fontWeight: '700',
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
    borderRadius: BorderRadius.full,
    marginTop: Spacing.sm,
  },
  goToWardrobeText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: FontSize.md,
  },
  previewSection: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
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
    fontSize: FontSize.xs,
    fontWeight: '600',
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
    fontSize: FontSize.sm,
    fontWeight: '600',
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
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.white,
    textAlign: 'center',
  },
  clearButton: {
    position: 'absolute',
    top: Spacing.xs,
    right: Spacing.xs,
    backgroundColor: 'rgba(0,0,0,0.5)',
    borderRadius: BorderRadius.full,
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
    fontSize: FontSize.md,
    fontWeight: '600',
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
    fontSize: FontSize.xs,
    fontWeight: '600',
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
    borderRadius: BorderRadius.full,
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
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
  },
  checkButtonDisabled: {
    opacity: 0.6,
  },
  checkButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  checkButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  checkButtonTextDisabled: {
    color: Colors.textMuted,
  },
});
