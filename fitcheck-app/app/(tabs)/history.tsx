import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, FlatList, TouchableOpacity, RefreshControl, Alert } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Fonts } from '../../src/constants/theme';
import OutfitCard from '../../src/components/OutfitCard';
import AdBanner from '../../src/components/AdBanner';
import { HistoryGridSkeleton } from '../../src/components/SkeletonLoader';
import ErrorState from '../../src/components/ErrorState';
import { useOutfits, useToggleFavorite, useDeleteOutfit, useReanalyzeOutfit } from '../../src/hooks/useApi';

const FILTERS = ['All', 'Favorites', 'Work', 'Casual', 'Date Night', 'Event', 'Interview'];

export default function HistoryScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeFilter, setActiveFilter] = useState('All');

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
    try { await refetch(); } finally { setRefreshing(false); }
  };

  const handleToggleFavorite = async (outfitId: string) => {
    try {
      await toggleFavoriteMutation.mutateAsync(outfitId);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleLongPress = (outfitId: string) => {
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
      { text: 'Compare Outfits', onPress: () => router.push(`/compare?preselectA=${outfitId}` as any) },
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
      {/* Header — Playfair Display italic title */}
      <View style={styles.header}>
        <Text style={styles.title}>Archive</Text>
      </View>

      {/* Filter chips — sharp corners (0px), uppercase */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.filters}
        style={styles.filtersContainer}
      >
        {FILTERS.map((f) => (
          <TouchableOpacity
            key={f}
            style={[styles.chip, activeFilter === f && styles.chipActive]}
            onPress={() => setActiveFilter(f)}
            activeOpacity={0.7}
          >
            <Text style={[styles.chipText, activeFilter === f && styles.chipTextActive]}>
              {f}
            </Text>
          </TouchableOpacity>
        ))}
      </ScrollView>

      {/* Editorial rule below filters */}
      <View style={styles.filterDivider} />

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
                  onLongPress={() => handleLongPress(item.id)}
                  onFavoritePress={() => handleToggleFavorite(item.id)}
                />
              </View>
            );
          }}
        />
      ) : (
        <View style={styles.empty}>
          <Ionicons name="shirt-outline" size={40} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>
            {activeFilter === 'All'
              ? 'No outfit checks yet'
              : activeFilter === 'Favorites'
              ? 'No favorites yet'
              : `No ${activeFilter.toLowerCase()} outfits`}
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
              <Text style={styles.emptyButtonText}>Check an outfit</Text>
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Compare FAB */}
      <TouchableOpacity
        style={[styles.compareFab, { bottom: Spacing.xl + Math.round(insets.bottom * 0.75) }]}
        onPress={() => router.push('/compare' as any)}
        activeOpacity={0.9}
      >
        <Ionicons name="git-compare-outline" size={22} color={Colors.white} />
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
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.md,
  },
  title: {
    fontFamily: Fonts.serif,
    fontSize: 30,
    color: Colors.text,
    lineHeight: 38,
  },
  filtersContainer: {
    flexGrow: 0,
    flexShrink: 0,
  },
  filters: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
    alignItems: 'center',
  },
  // Sharp-corner editorial chips
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.2)',
  },
  chipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  chipText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.0,
    color: Colors.textMuted,
  },
  chipTextActive: {
    color: Colors.white,
  },
  filterDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
    marginBottom: Spacing.md,
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
  empty: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  emptyTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 17,
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptySubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  emptyButton: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.xl,
    marginTop: Spacing.sm,
  },
  emptyButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.primary,
  },
  compareFab: {
    position: 'absolute',
    bottom: Spacing.xl,
    right: Spacing.lg,
    width: 52,
    height: 52,
    borderRadius: 0, // sharp — editorial spec
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
