import { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Image, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';

// Mock wardrobe items
const WARDROBE_ITEMS = {
  tops: [
    { id: 't1', name: 'White T-Shirt', color: 'White', imageUrl: 'https://via.placeholder.com/400x400' },
    { id: 't2', name: 'Blue Button-Down', color: 'Blue', imageUrl: 'https://via.placeholder.com/400x400' },
    { id: 't3', name: 'Black Sweater', color: 'Black', imageUrl: 'https://via.placeholder.com/400x400' },
  ],
  bottoms: [
    { id: 'b1', name: 'Blue Jeans', color: 'Blue', imageUrl: 'https://via.placeholder.com/400x400' },
    { id: 'b2', name: 'Black Slacks', color: 'Black', imageUrl: 'https://via.placeholder.com/400x400' },
    { id: 'b3', name: 'Khaki Chinos', color: 'Khaki', imageUrl: 'https://via.placeholder.com/400x400' },
  ],
  shoes: [
    { id: 's1', name: 'White Sneakers', color: 'White', imageUrl: 'https://via.placeholder.com/400x400' },
    { id: 's2', name: 'Brown Loafers', color: 'Brown', imageUrl: 'https://via.placeholder.com/400x400' },
    { id: 's3', name: 'Black Boots', color: 'Black', imageUrl: 'https://via.placeholder.com/400x400' },
  ],
  outerwear: [
    { id: 'o1', name: 'Leather Jacket', color: 'Black', imageUrl: 'https://via.placeholder.com/400x400' },
    { id: 'o2', name: 'Denim Jacket', color: 'Blue', imageUrl: 'https://via.placeholder.com/400x400' },
  ],
};

type OutfitSlot = {
  category: keyof typeof WARDROBE_ITEMS;
  label: string;
  icon: string;
  selected: any | null;
};

export default function OutfitBuilderScreen() {
  const router = useRouter();
  const [slots, setSlots] = useState<OutfitSlot[]>([
    { category: 'tops', label: 'Top', icon: 'shirt-outline', selected: null },
    { category: 'bottoms', label: 'Bottom', icon: 'body-outline', selected: null },
    { category: 'shoes', label: 'Shoes', icon: 'footsteps-outline', selected: null },
    { category: 'outerwear', label: 'Layer', icon: 'layers-outline', selected: null },
  ]);
  const [activeSlot, setActiveSlot] = useState<number | null>(null);

  const handleSlotPress = (index: number) => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    setActiveSlot(index);
  };

  const handleItemSelect = (item: any) => {
    if (activeSlot === null) return;

    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    const newSlots = [...slots];
    newSlots[activeSlot] = { ...newSlots[activeSlot], selected: item };
    setSlots(newSlots);
    setActiveSlot(null);
  };

  const handleClearSlot = (index: number) => {
    const newSlots = [...slots];
    newSlots[index] = { ...newSlots[index], selected: null };
    setSlots(newSlots);
  };

  const handleCheckOutfit = () => {
    const filledSlots = slots.filter(s => s.selected !== null);
    if (filledSlots.length < 2) {
      Alert.alert('Add More Items', 'Please select at least 2 items to check your outfit.');
      return;
    }

    Alert.alert('Coming Soon', 'Outfit checking from your wardrobe is coming in the next update!');
  };

  const handleShuffle = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy);
    // Random shuffle for now — AI-powered smart shuffle will use style preferences in a future update
    const newSlots = slots.map(slot => {
      const items = WARDROBE_ITEMS[slot.category];
      if (items && items.length > 0) {
        const randomItem = items[Math.floor(Math.random() * items.length)];
        return { ...slot, selected: randomItem };
      }
      return slot;
    });
    setSlots(newSlots);
  };

  const currentCategory = activeSlot !== null ? slots[activeSlot].category : null;
  const availableItems = currentCategory ? WARDROBE_ITEMS[currentCategory] : [];

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerButton} onPress={() => router.back()}>
          <Ionicons name="close" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Build an Outfit</Text>
        <TouchableOpacity style={styles.headerButton} onPress={handleShuffle}>
          <Ionicons name="shuffle" size={24} color={Colors.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Outfit Preview */}
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
                    <Image
                      source={{ uri: slot.selected.imageUrl }}
                      style={styles.slotImage}
                    />
                    <TouchableOpacity
                      style={styles.clearButton}
                      onPress={() => handleClearSlot(index)}
                    >
                      <Ionicons name="close-circle" size={20} color={Colors.white} />
                    </TouchableOpacity>
                    <View style={styles.slotLabel}>
                      <Text style={styles.slotLabelText}>{slot.label}</Text>
                    </View>
                  </>
                ) : (
                  <View style={styles.slotPlaceholder}>
                    <Ionicons name={slot.icon as any} size={32} color={Colors.textMuted} />
                    <Text style={styles.slotPlaceholderText}>{slot.label}</Text>
                  </View>
                )}
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Item Selector */}
        {activeSlot !== null && (
          <View style={styles.selectorSection}>
            <Text style={styles.sectionTitle}>
              Choose {slots[activeSlot].label}
            </Text>
            <View style={styles.itemGrid}>
              {availableItems.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemCard}
                  onPress={() => handleItemSelect(item)}
                  activeOpacity={0.8}
                >
                  <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemColor}>{item.color}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </View>
        )}

        {/* Empty State */}
        {activeSlot === null && slots.every(s => s.selected === null) && (
          <View style={styles.emptyState}>
            <View style={styles.emptyIcon}>
              <Ionicons name="layers-outline" size={48} color={Colors.textMuted} />
            </View>
            <Text style={styles.emptyTitle}>Start Building</Text>
            <Text style={styles.emptyText}>
              Tap a slot above to select items from your wardrobe
            </Text>
          </View>
        )}

        <View style={{ height: 120 }} />
      </ScrollView>

      {/* Action Buttons */}
      <View style={styles.footer}>
        <TouchableOpacity
          style={[
            styles.checkButton,
            slots.filter(s => s.selected).length < 2 && styles.checkButtonDisabled,
          ]}
          onPress={handleCheckOutfit}
          disabled={slots.filter(s => s.selected).length < 2}
          activeOpacity={0.8}
        >
          <LinearGradient
            colors={
              slots.filter(s => s.selected).length >= 2
                ? [Colors.primary, Colors.secondary]
                : [Colors.surface, Colors.surface]
            }
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.checkButtonGradient}
          >
            <Ionicons
              name="sparkles"
              size={20}
              color={slots.filter(s => s.selected).length >= 2 ? Colors.white : Colors.textMuted}
            />
            <Text
              style={[
                styles.checkButtonText,
                slots.filter(s => s.selected).length < 2 && styles.checkButtonTextDisabled,
              ]}
            >
              Check This Outfit
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
  },
  slotImage: {
    width: '100%',
    height: '100%',
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
  itemImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.surfaceLight,
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
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
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
    opacity: 0.5,
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
