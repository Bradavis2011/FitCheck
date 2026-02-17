import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, RefreshControl } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import OutfitCard from '../../src/components/OutfitCard';
import PillButton from '../../src/components/PillButton';
import { HistoryGridSkeleton } from '../../src/components/SkeletonLoader';
import ErrorState from '../../src/components/ErrorState';
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

  console.log('[History] Calling useOutfits with filters:', filters);
  const { data, isLoading, isError, error, refetch } = useOutfits(filters);
  console.log('[History] useOutfits result:', {
    hasData: !!data,
    isLoading,
    isError,
    errorMessage: error?.message,
    outfitCount: data?.outfits?.length || 0
  });
  const toggleFavoriteMutation = useToggleFavorite();
  const [refreshing, setRefreshing] = useState(false);

  const outfits = data?.outfits || [];

  // Debug logging
  if (outfits.length > 0) {
    console.log('[History] First outfit data:', {
      id: outfits[0].id,
      hasThumbnailUrl: !!outfits[0].thumbnailUrl,
      hasThumbnailData: !!outfits[0].thumbnailData,
      hasImageUrl: !!outfits[0].imageUrl,
      hasImageData: !!outfits[0].imageData,
      thumbnailDataLength: outfits[0].thumbnailData?.length || 0,
    });
  }

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await refetch();
    } finally {
      setRefreshing(false);
    }
  };

  const handleToggleFavorite = async (outfitId: string) => {
    try {
      await toggleFavoriteMutation.mutateAsync(outfitId);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <Text style={styles.title}>Your Outfits</Text>
      </View>

      {/* Filter tabs */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filtersContainer}
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
      {isLoading && !refreshing ? (
        <HistoryGridSkeleton count={6} />
      ) : isError ? (
        <ErrorState
          title="Couldn't load outfits"
          message={(error as Error)?.message || "We couldn't load your outfit history. Please check your connection and try again."}
          onRetry={() => refetch()}
          icon="shirt-outline"
        />
      ) : outfits.length > 0 ? (
        <FlatList
          data={outfits}
          numColumns={2}
          keyExtractor={(item) => item.id}
          contentContainerStyle={styles.grid}
          columnWrapperStyle={styles.gridRow}
          refreshControl={
            <RefreshControl
              refreshing={refreshing}
              onRefresh={handleRefresh}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
          renderItem={({ item }) => {
            // Format image URI properly - add base64 prefix if needed
            let imageUri = '';
            if (item.thumbnailData || item.imageData) {
              const base64Data = item.thumbnailData || item.imageData;
              imageUri = base64Data?.startsWith('data:')
                ? base64Data
                : `data:image/jpeg;base64,${base64Data}`;
            } else if (item.thumbnailUrl || item.imageUrl) {
              imageUri = item.thumbnailUrl || item.imageUrl || '';
            }

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
  filtersContainer: {
    paddingTop: Spacing.xs,
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
