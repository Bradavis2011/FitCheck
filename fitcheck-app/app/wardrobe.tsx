import { useState } from 'react';
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
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useWardrobeItems, useAddWardrobeItem, useDeleteWardrobeItem, useLogWear } from '../src/hooks/useApi';
import type { WardrobeCategory, WardrobeItem } from '../src/services/api.service';

type Category = WardrobeCategory | 'all';

const CATEGORIES: { id: Category; label: string; icon: string }[] = [
  { id: 'all', label: 'All', icon: 'grid' },
  { id: 'tops', label: 'Tops', icon: 'shirt' },
  { id: 'bottoms', label: 'Bottoms', icon: 'body' },
  { id: 'shoes', label: 'Shoes', icon: 'footsteps' },
  { id: 'accessories', label: 'Accessories', icon: 'bag-handle' },
  { id: 'outerwear', label: 'Outerwear', icon: 'layers' },
];

const WARDROBE_CATEGORIES: WardrobeCategory[] = ['tops', 'bottoms', 'shoes', 'accessories', 'outerwear'];

function categoryIcon(category: WardrobeCategory): string {
  return CATEGORIES.find((c) => c.id === category)?.icon ?? 'shirt';
}

function formatLastWorn(lastWorn: string | null): string {
  if (!lastWorn) return 'Never worn';
  const diff = Date.now() - new Date(lastWorn).getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 7) return `${days} days ago`;
  if (days < 30) return `${Math.floor(days / 7)} week${Math.floor(days / 7) > 1 ? 's' : ''} ago`;
  return `${Math.floor(days / 30)} month${Math.floor(days / 30) > 1 ? 's' : ''} ago`;
}

export default function WardrobeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<Category>('all');
  const [showAddModal, setShowAddModal] = useState(false);
  const [addName, setAddName] = useState('');
  const [addCategory, setAddCategory] = useState<WardrobeCategory>('tops');
  const [addColor, setAddColor] = useState('');

  const apiCategory = selectedCategory === 'all' ? undefined : selectedCategory;
  const { data, isLoading, isError } = useWardrobeItems(apiCategory);
  const items: WardrobeItem[] = data?.items ?? [];

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
    Alert.alert(item.name, `Category: ${item.category}\nColor: ${item.color ?? '—'}\nWorn ${item.timesWorn}x\nLast worn: ${formatLastWorn(item.lastWorn)}`, [
      { text: 'Log Wear', onPress: () => handleLogWear(item) },
      { text: 'Delete', style: 'destructive', onPress: () => handleDelete(item) },
      { text: 'Close', style: 'cancel' },
    ]);
  }

  return (
    <View style={styles.container}>
      <Stack.Screen
        options={{
          title: 'My Wardrobe',
          headerLeft: () => (
            <TouchableOpacity onPress={() => router.back()}>
              <Ionicons name="arrow-back" size={24} color={Colors.text} />
            </TouchableOpacity>
          ),
          headerRight: () => (
            <TouchableOpacity onPress={() => setShowAddModal(true)}>
              <Ionicons name="add-circle" size={28} color={Colors.primary} />
            </TouchableOpacity>
          ),
        }}
      />

      {/* Category Filter */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.categoriesContainer}
        contentContainerStyle={styles.categories}
      >
        {CATEGORIES.map((cat) => (
          <TouchableOpacity
            key={cat.id}
            style={[styles.categoryChip, selectedCategory === cat.id && styles.categoryChipActive]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons
              name={cat.icon as any}
              size={18}
              color={selectedCategory === cat.id ? Colors.white : Colors.text}
            />
            <Text style={[styles.categoryText, selectedCategory === cat.id && styles.categoryTextActive]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items Grid */}
      <ScrollView style={styles.content}>
        {isLoading ? (
          <ActivityIndicator style={styles.loader} color={Colors.primary} />
        ) : isError ? (
          <View style={styles.empty}>
            <Ionicons name="cloud-offline-outline" size={48} color={Colors.textMuted} />
            <Text style={styles.emptyText}>Could not load wardrobe</Text>
            <Text style={styles.emptySubtext}>Check your connection and try again</Text>
          </View>
        ) : items.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shirt-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>
              {selectedCategory === 'all' ? 'Your wardrobe is empty' : 'No items in this category'}
            </Text>
            <Text style={styles.emptySubtext}>
              Tap the + button to add your first item
            </Text>
            <TouchableOpacity style={styles.emptyAddButton} onPress={() => setShowAddModal(true)}>
              <Text style={styles.emptyAddButtonText}>Add Item</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <View style={styles.grid}>
            {items.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => handleItemPress(item)}
                activeOpacity={0.8}
              >
                {item.imageUrl ? (
                  <Image source={{ uri: item.imageUrl }} style={styles.itemImage} />
                ) : (
                  <View style={styles.itemPlaceholder}>
                    <Ionicons
                      name={categoryIcon(item.category) as any}
                      size={32}
                      color={Colors.textMuted}
                    />
                  </View>
                )}
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>
                    {item.name}
                  </Text>
                  {item.color ? (
                    <Text style={styles.itemMeta}>{item.color}</Text>
                  ) : null}
                  <Text style={styles.itemMeta}>Worn {item.timesWorn}x</Text>
                  <Text style={styles.itemLastWorn}>{formatLastWorn(item.lastWorn)}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
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
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
            <Text style={styles.modalTitle}>Add Item</Text>
            <TouchableOpacity onPress={handleAdd} disabled={addItem.isPending}>
              {addItem.isPending ? (
                <ActivityIndicator color={Colors.primary} />
              ) : (
                <Text style={styles.modalSave}>Save</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={styles.modalBody} keyboardShouldPersistTaps="handled">
            {/* Name */}
            <Text style={styles.fieldLabel}>Name *</Text>
            <TextInput
              style={styles.textInput}
              value={addName}
              onChangeText={setAddName}
              placeholder="e.g. White Oxford Shirt"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
            />

            {/* Color */}
            <Text style={styles.fieldLabel}>Color</Text>
            <TextInput
              style={styles.textInput}
              value={addColor}
              onChangeText={setAddColor}
              placeholder="e.g. Navy Blue"
              placeholderTextColor={Colors.textMuted}
              returnKeyType="done"
            />

            {/* Category */}
            <Text style={styles.fieldLabel}>Category</Text>
            <View style={styles.categoryPicker}>
              {WARDROBE_CATEGORIES.map((cat) => {
                const meta = CATEGORIES.find((c) => c.id === cat)!;
                return (
                  <TouchableOpacity
                    key={cat}
                    style={[styles.categoryOption, addCategory === cat && styles.categoryOptionActive]}
                    onPress={() => setAddCategory(cat)}
                  >
                    <Ionicons
                      name={meta.icon as any}
                      size={20}
                      color={addCategory === cat ? Colors.white : Colors.text}
                    />
                    <Text
                      style={[
                        styles.categoryOptionText,
                        addCategory === cat && styles.categoryOptionTextActive,
                      ]}
                    >
                      {meta.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
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
  categoriesContainer: {
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  categories: {
    flexDirection: 'row',
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryTextActive: {
    color: Colors.white,
  },
  content: {
    flex: 1,
  },
  loader: {
    marginTop: Spacing.xl * 2,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  itemCard: {
    width: '47%',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  itemImage: {
    width: '100%',
    aspectRatio: 1,
    backgroundColor: Colors.surface,
  },
  itemPlaceholder: {
    aspectRatio: 1,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  itemInfo: {
    padding: Spacing.sm,
  },
  itemName: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 2,
  },
  itemMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  itemLastWorn: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyAddButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  emptyAddButtonText: {
    color: Colors.white,
    fontWeight: '700',
    fontSize: FontSize.md,
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
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSave: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  modalBody: {
    flex: 1,
    padding: Spacing.md,
  },
  fieldLabel: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
    marginTop: Spacing.md,
  },
  textInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
  },
  categoryPicker: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.xs,
  },
  categoryOption: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  categoryOptionActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  categoryOptionText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  categoryOptionTextActive: {
    color: Colors.white,
  },
});
