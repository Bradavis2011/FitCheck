import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  Alert,
  Modal,
  TextInput,
  ActivityIndicator,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius, Fonts, Editorial } from '../src/constants/theme';
import { useWardrobeItems, useAddWardrobeItem, useDeleteWardrobeItem, useLogWear, useWardrobeItemOutfits } from '../src/hooks/useApi';
import type { WardrobeCategory, WardrobeItem } from '../src/services/api.service';
import { track } from '../src/lib/analytics';

type Category = WardrobeCategory | 'all';

const CATEGORIES: { id: Category; label: string }[] = [
  { id: 'all', label: 'All' },
  { id: 'tops', label: 'Tops' },
  { id: 'bottoms', label: 'Bottoms' },
  { id: 'shoes', label: 'Shoes' },
  { id: 'accessories', label: 'Accessories' },
  { id: 'outerwear', label: 'Outerwear' },
];

const WARDROBE_CATEGORIES: WardrobeCategory[] = ['tops', 'bottoms', 'shoes', 'accessories', 'outerwear'];

function formatLastWorn(lastWorn: string | null): string {
  if (!lastWorn) return 'Never worn';
  const diff = Date.now() - new Date(lastWorn).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days}d ago`;
  if (days < 30) return `${Math.floor(days / 7)}w ago`;
  return `${Math.floor(days / 30)}mo ago`;
}

export default function WardrobeScreen() {
  useEffect(() => { track('feature_used', { feature: 'wardrobe' }); }, []);
  const insets = useSafeAreaInsets();
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState<WardrobeCategory>('tops');
  const [addColor, setAddColor] = useState('');
  const [selectedItemId, setSelectedItemId] = useState<string | null>(null);

  const apiCategory = selectedCategory === 'all' ? undefined : selectedCategory;
  const { data, isLoading, isError } = useWardrobeItems(apiCategory ? { category: apiCategory } : undefined);
  const items: WardrobeItem[] = data?.items ?? [];

  const { data: itemOutfitsData } = useWardrobeItemOutfits(selectedItemId);

  const addItem = useAddWardrobeItem();
  const deleteItem = useDeleteWardrobeItem();
  const logWear = useLogWear();

  function handleAdd() {
    const name = addName.trim();
    if (!name) {
      Alert.alert('Name required', 'Please enter a name for this item.');
      return;
    }
    addItem.mutate(
      { name, category: addCategory, color: addColor.trim() || undefined },
      {
        onSuccess: () => {
          setAddName('');
          setAddColor('');
          setAddCategory('tops');
          setShowAddModal(false);
        },
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? 'Could not add item. Try again.';
          Alert.alert('Error', msg);
        },
      }
    );
  }

  function handleDelete(item: WardrobeItem) {
    Alert.alert(
      'Remove Item',
      `Remove "${item.name}" from your wardrobe?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Remove',
          style: 'destructive',
          onPress: () =>
            deleteItem.mutate(item.id, {
              onError: () => Alert.alert('Error', 'Could not remove item. Try again.'),
            }),
        },
      ]
    );
  }

  function handleLogWear(item: WardrobeItem) {
    logWear.mutate(item.id, {
      onError: () => Alert.alert('Error', 'Could not log wear. Try again.'),
    });
  }

  function handleItemPress(item: WardrobeItem) {
    if (item.source === 'ai-detected') {
      setSelectedItemId(item.id);
      const outfitCount = item._count?.outfitLinks ?? item.timesWorn;
      Alert.alert(
        item.name,
        `${item.category}${item.color ? `  ·  ${item.color}` : ''}\nSeen in ${outfitCount} outfit${outfitCount !== 1 ? 's' : ''}\n${formatLastWorn(item.lastWorn)}\n\nAI-detected`,
        [
          { text: 'Log Wear', onPress: () => handleLogWear(item) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
          { text: 'Close', style: 'cancel', onPress: () => setSelectedItemId(null) },
        ]
      );
    } else {
      Alert.alert(
        item.name,
        `${item.category}${item.color ? `  ·  ${item.color}` : ''}\nWorn ${item.timesWorn}×\n${formatLastWorn(item.lastWorn)}`,
        [
          { text: 'Log Wear', onPress: () => handleLogWear(item) },
          { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
          { text: 'Close', style: 'cancel' },
        ]
      );
    }
  }

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      {/* Custom editorial header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>The Closet</Text>
        <TouchableOpacity onPress={() => setShowAddModal(true)} hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}>
          <Text style={styles.addLabel}>+ ADD</Text>
        </TouchableOpacity>
      </View>

      {/* Editorial rule */}
      <View style={styles.rule} />

      {/* Category filter — text tabs, no icons */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.tabsContainer}
        contentContainerStyle={styles.tabs}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={styles.tab}
            onPress={() => setSelectedCategory(cat.id)}
            activeOpacity={0.7}
          >
            <Text style={[styles.tabText, selectedCategory === cat.id && styles.tabTextActive]}>
              {cat.label.toUpperCase()}
            </Text>
            {selectedCategory === cat.id && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        ))}
      </ScrollView>

      <View style={styles.rule} />

      {/* Items Grid */}
      <ScrollView style={styles.content} showsVerticalScrollIndicator={false}>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={Colors.primary} />
        ) : isError ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={40} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Could not load wardrobe</Text>
            <Text style={styles.emptySubtext}>Check your connection and try again</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Text style={styles.emptyHeadline}>
              {selectedCategory === 'all' ? 'Your closet is empty' : `No ${selectedCategory} yet`}
            </Text>
            <Text style={styles.emptySubtext}>
              {selectedCategory === 'all'
                ? 'Items detected in your outfit checks appear here automatically, or add them manually.'
                : 'Add items manually or get more outfit checks.'}
            </Text>
            <TouchableOpacity style={styles.emptyAddButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyAddButtonText}>ADD ITEM</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <Text style={styles.itemCount}>{items.length} ITEM{items.length !== 1 ? 'S' : ''}</Text>
            <View style={styles.grid}>
              {items.map((item) => (
                <TouchableOpacity
                  key={item.id}
                  style={styles.itemCard}
                  onPress={() => handleItemPress(item)}
                  activeOpacity={0.85}
                >
                  {item.imageUrl ? (
                    <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                  ) : (
                    <View style={styles.itemPlaceholder}>
                      <Text style={styles.placeholderCategory}>
                        {item.category.slice(0, 3).toUpperCase()}
                      </Text>
                    </View>
                  )}
                  {item.source === 'ai-detected' && (
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>AI</Text>
                    </View>
                  )}
                  <View style={styles.itemInfo}>
                    <Text style={styles.itemName} numberOfLines={1}>
                      {item.name}
                    </Text>
                    <Text style={styles.itemMeta} numberOfLines={1}>
                      {item.color ? `${item.color}  ·  ` : ''}
                      {item.source === 'ai-detected'
                        ? `${item._count?.outfitLinks ?? item.timesWorn} outfits`
                        : `${item.timesWorn}×`}
                    </Text>
                    <Text style={styles.itemLastWorn}>{formatLastWorn(item.lastWorn)}</Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          </>
        )}
        <View style={{ height: 48 }} />
      </ScrollView>

      {/* Add Item Modal */}
      <Modal
        visible={showAddModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowAddModal(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={() => setShowAddModal(false)}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Item</Text>
            <TouchableOpacity onPress={handleAdd} disabled={addItem.isPending}>
              {addItem.isPending ? (
                <ActivityIndicator color={Colors.primary} size="small" />
              ) : (
                <Text style={styles.modalSave}>SAVE</Text>
              )}
            </TouchableOpacity>
          </View>
          <View style={styles.modalRule} />

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            <Text style={styles.fieldLabel}>NAME *</Text>
            <TextInput
              style={styles.textInput}
              value={addName}
              onChangeText={setAddName}
              placeholder="e.g. White Oxford Shirt"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
            />

            <Text style={styles.fieldLabel}>COLOR</Text>
            <TextInput
              style={styles.textInput}
              value={addColor}
              onChangeText={setAddColor}
              placeholder="e.g. Navy Blue"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
            />

            <Text style={styles.fieldLabel}>CATEGORY</Text>
            <View style={styles.categoryPicker}>
              {WARDROBE_CATEGORIES.map((cat) => (
                <TouchableOpacity
                  key={cat}
                  style={[styles.categoryOption, addCategory === cat && styles.categoryOptionActive]}
                  onPress={() => setAddCategory(cat)}
                  activeOpacity={0.7}
                >
                  <Text
                    style={[
                      styles.categoryOptionText,
                      addCategory === cat && styles.categoryOptionTextActive,
                    ]}
                  >
                    {cat.toUpperCase()}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // Header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: 14,
  },
  screenTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  addLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.primary,
  },

  // Rule
  rule: {
    height: 1,
    backgroundColor: Colors.border,
  },

  // Category tabs
  tabsContainer: {
    flexGrow: 0,
  },
  tabs: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    gap: 0,
  },
  tab: {
    paddingHorizontal: 14,
    paddingVertical: 12,
    alignItems: 'center',
    position: 'relative',
  },
  tabText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.text,
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 14,
    right: 14,
    height: 2,
    backgroundColor: Colors.primary,
  },

  // Content
  content: {
    flex: 1,
  },
  loader: {
    marginTop: 64,
  },

  // Item count label
  itemCount: {
    ...Editorial.sectionLabel,
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },

  // Grid
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: Spacing.md,
    gap: 12,
  },
  itemCard: {
    width: '47%',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
    position: 'relative',
  },
  aiBadge: {
    position: 'absolute',
    top: 6,
    right: 6,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.sharp,
    paddingHorizontal: 5,
    paddingVertical: 2,
    zIndex: 1,
  },
  aiBadgeText: {
    fontFamily: Fonts.sansBold,
    color: Colors.white,
    fontSize: 9,
    letterSpacing: 0.8,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.backgroundSecondary,
  },
  itemPlaceholder: {
    aspectRatio: 1,
    backgroundColor: Colors.backgroundSecondary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  placeholderCategory: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 2,
    color: Colors.textMuted,
  },
  itemInfo: {
    padding: 10,
    gap: 2,
  },
  itemName: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 13,
    color: Colors.text,
  },
  itemMeta: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
  },
  itemLastWorn: {
    fontFamily: Fonts.sans,
    fontSize: 11,
    color: Colors.textMuted,
    letterSpacing: 0.2,
  },

  // Empty state
  empty: {
    alignItems: 'center',
    paddingVertical: 72,
    paddingHorizontal: Spacing.xl,
    gap: 10,
  },
  emptyHeadline: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.text,
    textAlign: 'center',
    letterSpacing: 0.3,
  },
  emptyText: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 16,
    color: Colors.text,
    textAlign: 'center',
  },
  emptySubtext: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAddButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: 13,
    borderRadius: BorderRadius.sharp,
  },
  emptyAddButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.white,
  },

  // Modal
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: 14,
  },
  modalRule: {
    height: 1,
    backgroundColor: Colors.border,
  },
  modalTitle: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Colors.text,
    letterSpacing: 0.3,
  },
  modalSave: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.primary,
  },
  modalBody: {
    flex: 1,
    padding: Spacing.md,
  },
  fieldLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.textMuted,
    marginBottom: 8,
    marginTop: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.sharp,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: 13,
    fontFamily: Fonts.sans,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: 4,
  },
  categoryOption: {
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: BorderRadius.sharp,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryOptionActive: {
    backgroundColor: Colors.text,
    borderColor: Colors.text,
  },
  categoryOptionText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.6,
    color: Colors.text,
  },
  categoryOptionTextActive: {
    color: Colors.white,
  },
});
