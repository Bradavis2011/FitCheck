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
  const [selectedItem, setSelectedItem] = useState<WardrobeItem | null>(null);
  const [showOutfitsModal, setShowOutfitsModal] = useState(false);

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

  function dismissOutfitsModal() {
    setShowOutfitsModal(false);
    setSelectedItemId(null);
    setSelectedItem(null);
  }

  function handleItemPress(item: WardrobeItem) {
    if (item.source === 'ai-detected') {
      setSelectedItemId(item.id);
      setSelectedItem(item);
      setShowOutfitsModal(true);
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
                    <Image source={{ uri: item.imageUrl }} style={styles.itemImage} resizeMode="cover" />
                  ) : (
                    <View style={styles.itemPlaceholder}>
                      <View style={styles.placeholderRule} />
                      <Text style={styles.placeholderCategory}>
                        {item.category.charAt(0).toUpperCase() + item.category.slice(1)}
                      </Text>
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

      {/* Outfit Sources Modal (AI-detected items) */}
      <Modal
        visible={showOutfitsModal}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={dismissOutfitsModal}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <TouchableOpacity onPress={dismissOutfitsModal}>
              <Ionicons name="close" size={22} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle} numberOfLines={1}>{selectedItem?.name ?? ''}</Text>
            <View style={{ width: 22 }} />
          </View>
          <View style={styles.modalRule} />

          <ScrollView style={styles.modalBody} showsVerticalScrollIndicator={false}>
            {/* Item meta */}
            <Text style={styles.fieldLabel}>
              {selectedItem?.category?.toUpperCase()}
              {selectedItem?.color ? `  ·  ${selectedItem.color.toUpperCase()}` : ''}
              {'  ·  ' + formatLastWorn(selectedItem?.lastWorn ?? null).toUpperCase()}
            </Text>

            {/* Outfit links */}
            <Text style={[styles.fieldLabel, { marginTop: Spacing.lg }]}>
              SEEN IN {(selectedItem?._count?.outfitLinks ?? 0)} OUTFIT{(selectedItem?._count?.outfitLinks ?? 0) !== 1 ? 'S' : ''}
            </Text>

            {!itemOutfitsData ? (
              <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
            ) : itemOutfitsData.outfits.length === 0 ? (
              <Text style={styles.emptySubtext}>No linked outfits found.</Text>
            ) : (
              itemOutfitsData.outfits.map((outfit) => (
                <TouchableOpacity
                  key={outfit.id}
                  style={styles.outfitRow}
                  activeOpacity={0.7}
                  onPress={() => {
                    dismissOutfitsModal();
                    router.push(`/feedback?outfitId=${outfit.id}` as any);
                  }}
                >
                  <View style={styles.outfitThumb}>
                    {outfit.thumbnailUrl || outfit.thumbnailData ? (
                      <Image
                        source={{ uri: outfit.thumbnailUrl ?? `data:image/jpeg;base64,${outfit.thumbnailData}` }}
                        style={styles.outfitThumbImg}
                        resizeMode="cover"
                      />
                    ) : (
                      <View style={styles.outfitThumbPlaceholder} />
                    )}
                  </View>
                  <View style={styles.outfitRowInfo}>
                    <Text style={styles.outfitRowDate}>
                      {new Date(outfit.createdAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' })}
                    </Text>
                    {outfit.occasions?.length > 0 && (
                      <Text style={styles.outfitRowOccasion} numberOfLines={1}>
                        {outfit.occasions.join(' · ')}
                      </Text>
                    )}
                  </View>
                  {outfit.aiScore !== null && (
                    <Text style={styles.outfitRowScore}>{outfit.aiScore.toFixed(1)}</Text>
                  )}
                  <Ionicons name="chevron-forward" size={14} color={Colors.textMuted} />
                </TouchableOpacity>
              ))
            )}

            {/* Actions */}
            <View style={[styles.modalRule, { marginTop: Spacing.lg }]} />
            <View style={styles.itemActions}>
              <TouchableOpacity
                style={styles.actionButton}
                onPress={() => { if (selectedItem) handleLogWear(selectedItem); dismissOutfitsModal(); }}
              >
                <Text style={styles.actionButtonText}>LOG WEAR</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionButton, styles.actionButtonDestructive]}
                onPress={() => { if (selectedItem) handleDelete(selectedItem); dismissOutfitsModal(); }}
              >
                <Text style={[styles.actionButtonText, { color: Colors.error }]}>REMOVE</Text>
              </TouchableOpacity>
            </View>
            <View style={{ height: 32 }} />
          </ScrollView>
        </SafeAreaView>
      </Modal>

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
    gap: 8,
  },
  placeholderRule: {
    width: 16,
    height: 1,
    backgroundColor: Colors.primary,
  },
  placeholderCategory: {
    fontFamily: Fonts.serifItalic,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.2,
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

  // Outfit rows (inside outfits modal)
  outfitRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  outfitThumb: {
    width: 52,
    height: 52,
    borderRadius: BorderRadius.sm,
    overflow: 'hidden',
    backgroundColor: Colors.backgroundSecondary,
  },
  outfitThumbImg: {
    width: 52,
    height: 52,
  },
  outfitThumbPlaceholder: {
    width: 52,
    height: 52,
    backgroundColor: Colors.backgroundSecondary,
  },
  outfitRowInfo: {
    flex: 1,
    gap: 3,
  },
  outfitRowDate: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: Colors.text,
  },
  outfitRowOccasion: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
  },
  outfitRowScore: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Colors.text,
    marginRight: 2,
  },
  itemActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  actionButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: BorderRadius.sharp,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  actionButtonDestructive: {
    borderColor: Colors.error,
  },
  actionButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    letterSpacing: 1.8,
    color: Colors.text,
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
