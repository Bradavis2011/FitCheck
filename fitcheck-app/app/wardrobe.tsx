import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, Alert } from 'react-native';
import { Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useState } from 'react';

type WardrobeItem = {
  id: string;
  name: string;
  category: 'tops' | 'bottoms' | 'shoes' | 'accessories' | 'outerwear';
  imageUrl?: string;
  color: string;
  timesWorn: number;
  lastWorn?: string;
};

const MOCK_ITEMS: WardrobeItem[] = [
  {
    id: '1',
    name: 'White Oxford Shirt',
    category: 'tops',
    color: 'White',
    timesWorn: 12,
    lastWorn: '2 days ago',
  },
  {
    id: '2',
    name: 'Navy Blazer',
    category: 'outerwear',
    color: 'Navy',
    timesWorn: 8,
    lastWorn: '1 week ago',
  },
  {
    id: '3',
    name: 'Brown Leather Shoes',
    category: 'shoes',
    color: 'Brown',
    timesWorn: 15,
    lastWorn: '3 days ago',
  },
];

export default function WardrobeScreen() {
  const [selectedCategory, setSelectedCategory] = useState<string>('all');

  const categories = [
    { id: 'all', label: 'All', icon: 'grid' },
    { id: 'tops', label: 'Tops', icon: 'shirt' },
    { id: 'bottoms', label: 'Bottoms', icon: 'body' },
    { id: 'shoes', label: 'Shoes', icon: 'footsteps' },
    { id: 'accessories', label: 'Accessories', icon: 'bag-handle' },
    { id: 'outerwear', label: 'Outerwear', icon: 'layers' },
  ];

  const filteredItems = selectedCategory === 'all'
    ? MOCK_ITEMS
    : MOCK_ITEMS.filter(item => item.category === selectedCategory);

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
            <TouchableOpacity onPress={() => Alert.alert('Coming Soon', 'Add items from outfit photos')}>
              <Ionicons name="add-circle" size={24} color={Colors.primary} />
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
        {categories.map(cat => (
          <TouchableOpacity
            key={cat.id}
            style={[
              styles.categoryChip,
              selectedCategory === cat.id && styles.categoryChipActive
            ]}
            onPress={() => setSelectedCategory(cat.id)}
          >
            <Ionicons
              name={cat.icon as any}
              size={18}
              color={selectedCategory === cat.id ? Colors.white : Colors.text}
            />
            <Text style={[
              styles.categoryText,
              selectedCategory === cat.id && styles.categoryTextActive
            ]}>
              {cat.label}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Items Grid */}
      <ScrollView style={styles.content}>
        {filteredItems.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="shirt-outline" size={64} color={Colors.textMuted} />
            <Text style={styles.emptyText}>No items in this category</Text>
            <Text style={styles.emptySubtext}>
              Upload outfit photos to start building your wardrobe
            </Text>
          </View>
        ) : (
          <View style={styles.grid}>
            {filteredItems.map(item => (
              <TouchableOpacity
                key={item.id}
                style={styles.itemCard}
                onPress={() => Alert.alert(item.name, `Worn ${item.timesWorn} times\nLast worn: ${item.lastWorn}`)}
              >
                <View style={styles.itemPlaceholder}>
                  <Ionicons
                    name={categories.find(c => c.id === item.category)?.icon as any || 'shirt'}
                    size={32}
                    color={Colors.textMuted}
                  />
                </View>
                <View style={styles.itemInfo}>
                  <Text style={styles.itemName} numberOfLines={2}>{item.name}</Text>
                  <Text style={styles.itemMeta}>{item.color}</Text>
                  <Text style={styles.itemMeta}>Worn {item.timesWorn}x</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Feature Placeholder */}
        <View style={styles.featureBanner}>
          <Ionicons name="sparkles" size={24} color={Colors.primary} />
          <View style={styles.featureText}>
            <Text style={styles.featureTitle}>Coming Soon</Text>
            <Text style={styles.featureDesc}>
              Automatically tag items from your outfit photos
            </Text>
          </View>
        </View>
      </ScrollView>
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
    marginBottom: 4,
  },
  itemMeta: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  empty: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 64,
    paddingHorizontal: Spacing.xl,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
    textAlign: 'center',
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: Spacing.xs,
    textAlign: 'center',
  },
  featureBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.md,
    margin: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderStyle: 'dashed',
  },
  featureText: {
    flex: 1,
  },
  featureTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  featureDesc: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
