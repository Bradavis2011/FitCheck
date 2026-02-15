import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import OutfitCard from '../../src/components/OutfitCard';
import PillButton from '../../src/components/PillButton';
import { HistoryGridSkeleton } from '../../src/components/SkeletonLoader';
import { useOutfits, useToggleFavorite } from '../../src/hooks/useApi';

const FILTERS = ['All', 'Favorites', 'Work', 'Casual', 'Date Night', 'Event', 'Interview'];

export default function HistoryScreen() {
  const router = useRouter();
  const [activeFilter, setActiveFilter] = useState('All');

  // Build API filters
  const filters: any = {};
  if (activeFilter === 'Favorites') {
    filters.isFavorite = true;
  } else if (activeFilter !== 'All') {
    filters.occasion = activeFilter;
  }

  const { data, isLoading } = useOutfits(filters);
  const toggleFavoriteMutation = useToggleFavorite();

  const outfits = data?.outfits || [];

  const handleToggleFavorite = async (outfitId: string) => {
    try {
      await toggleFavoriteMutation.mutateAsync(outfitId);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Outfits</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
      >
        {FILTERS.map((f) => (
          <PillButton
            key={f}
            label={f}
            selected={activeFilter === f}
            onPress={() => setActiveFilter(f)}
            small
          />
        ))}
      </ScrollView>

      {/* Grid */}
      {isLoading ? (
        <HistoryGridSkeleton count={6} />
      ) : outfits.length > 0 ? (
        <FlatList
          data={outfits}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          renderItem={({ item }) => {
            const imageUri = item.thumbnailUrl || item.thumbnailData || item.imageUrl || item.imageData || '';
            return (
              <View style={styles.gridItem}>
                <OutfitCard
                  imageUrl={imageUri}
                  score={item.aiScore || 0}
                  occasions={item.occasions || []}
                  isFavorite={item.isFavorite}
                  onPress={() => router.push(`/feedback?outfitId=${item.id}` as any)}
                  onFavoritePress={() => handleToggleFavorite(item.id)}
                />
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.empty}>
          <View style={styles.emptyIcon}>
            <Ionicons name="shirt-outline" size={40} color={Colors.textMuted} />
          </View>
          <Text style={styles.emptyTitle}>
            {activeFilter === 'All'
              ? 'No outfit checks yet'
              : activeFilter === 'Favorites'
              ? 'No favorites yet'
              : `No ${activeFilter.toLowerCase()} outfits found`}
          </Text>
          <Text style={styles.emptySubtitle}>
            {activeFilter === 'All'
              ? 'Start your first check to see your outfits here'
              : activeFilter === 'Favorites'
              ? 'Heart your favorite looks to save them here'
              : `No ${activeFilter.toLowerCase()} outfits found`}
          </Text>
          {activeFilter === 'All' && (
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/camera')}
            >
              <Ionicons name="camera" size={20} color={Colors.white} />
              <Text style={styles.emptyButtonText}>Start your first check</Text>
            </TouchableOpacity>
          )}
        </View>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  header: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  title: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  filters: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
  },
  grid: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  gridRow: {
    gap: Spacing.sm,
    marginBottom: Spacing.sm,
  },
  gridItem: {
    flex: 1,
  },
  loading: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    width: 96,
    height: 96,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.md,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    paddingHorizontal: 24,
    paddingVertical: 12,
    marginTop: Spacing.sm,
  },
  emptyButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
});
