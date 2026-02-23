import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import OutfitCard from '../../src/components/OutfitCard';
import AdBanner from '../../src/components/AdBanner';
import PillButton from '../../src/components/PillButton';
import { HistoryGridSkeleton } from '../../src/components/SkeletonLoader';
import ErrorState from '../../src/components/ErrorState';
import { useOutfits, useToggleFavorite, useDeleteOutfit, useReanalyzeOutfit } from '../../src/hooks/useApi';

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

  const { data, isLoading, isError, error, refetch } = useOutfits(filters);
  const toggleFavoriteMutation = useToggleFavorite();
  const deleteOutfitMutation = useDeleteOutfit();
  const reanalyzeMutation = useReanalyzeOutfit();
  const [refreshing, setRefreshing] = useState(false);

  const outfits = data?.outfits || [];

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

  const handleLongPress = (outfitId: string, imageUri: string) => {
    Alert.alert('Outfit Options', '', [
      {
        text: 'Re-analyze',
        onPress: () => {
          reanalyzeMutation.mutate(outfitId, {
            onSuccess: () => Alert.alert('Re-analyzing', 'Your outfit is being re-analyzed. Check back in a moment.'),
            onError: () => Alert.alert('Error', 'Failed to start re-analysis. Please try again.'),
          });
        },
      },
      {
        text: 'Compare Outfits',
        onPress: () => router.push('/compare' as any),
      },
      {
        text: 'Delete',
        style: 'destructive',
        onPress: () => {
          Alert.alert('Delete Outfit', 'This will permanently remove this outfit from your history.', [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Delete',
              style: 'destructive',
              onPress: () => {
                deleteOutfitMutation.mutate(outfitId, {
                  onError: () => Alert.alert('Error', 'Failed to delete outfit. Please try again.'),
                });
              },
            },
          ]);
        },
      },
      { text: 'Cancel', style: 'cancel' },
    ]);
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
          ListFooterComponent={<AdBanner />}
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
                  onLongPress={() => handleLongPress(item.id, imageUri)}
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

      {/* Compare FAB */}
      <TouchableOpacity
        style={styles.compareFab}
        onPress={() => router.push('/compare' as any)}
        activeOpacity={0.9}
      >
        <Ionicons name="git-compare-outline" size={24} color={Colors.white} />
      </TouchableOpacity>
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
    flexGrow: 0,
    flexShrink: 0,
  },
  filters: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.xs,
    paddingBottom: Spacing.md,
    gap: Spacing.sm,
    alignItems: 'center',
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
  compareFab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 8,
    elevation: 8,
  },
});
