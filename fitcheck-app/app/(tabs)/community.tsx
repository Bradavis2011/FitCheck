import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import OutfitFeedCard from '../../src/components/OutfitFeedCard';
import ComparisonCard from '../../src/components/ComparisonCard';
import { useCommunityFeed, useComparisonFeed, useVoteOnComparison } from '../../src/hooks/useApi';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';

type FeedFilter = 'recent' | 'popular' | 'top-rated' | 'inner_circle';

export default function CommunityScreen() {
  const router = useRouter();
  const { tier } = useSubscriptionStore();
  const [filter, setFilter] = useState<FeedFilter>('recent');
  const [offset, setOffset] = useState(0);

  const { data, isLoading, refetch, isFetching } = useCommunityFeed({
    filter: (filter === 'inner_circle' ? 'recent' : filter) as 'recent' | 'popular' | 'top-rated',
    limit: 20,
    offset,
  });

  const { data: comparisonData, refetch: refetchComparisons } = useComparisonFeed({ limit: 10 });
  const voteMutation = useVoteOnComparison();

  const outfits = data?.outfits || [];
  const hasMore = data?.hasMore || false;
  const comparisonPosts = comparisonData?.posts || [];

  const handleRefresh = () => {
    setOffset(0);
    refetch();
    refetchComparisons();
  };

  const handleLoadMore = () => {
    if (!isFetching && hasMore) {
      setOffset(offset + 20);
    }
  };

  const handleFilterChange = (newFilter: FeedFilter) => {
    setFilter(newFilter);
    setOffset(0);
  };

  const renderFilterButton = (label: string, value: FeedFilter) => (
    <TouchableOpacity
      style={[styles.filterButton, filter === value && styles.filterButtonActive]}
      onPress={() => handleFilterChange(value)}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterText, filter === value && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderFooter = () => {
    if (!isFetching) return null;
    return (
      <View style={styles.loadingFooter}>
        <ActivityIndicator size="small" color={Colors.primary} />
      </View>
    );
  };

  const renderEmpty = () => {
    if (isLoading || isFetching) return null;
    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No outfits yet</Text>
        <Text style={styles.emptyText}>
          Be the first to share your style with the community!
        </Text>
      </View>
    );
  };

  // Transform API data to match component props
  const transformedOutfits = outfits.map((outfit) => ({
    id: outfit.id,
    imageUrl: outfit.thumbnailUrl || outfit.imageUrl || '',
    thumbnailData: outfit.thumbnailData,
    score: outfit.aiScore,
    occasions: outfit.occasions,
    feedbackCount: outfit._count.communityFeedback,
    username: outfit.user.username || outfit.user.name || 'Anonymous',
    createdAt: outfit.createdAt,
  }));

  const renderComparisonSection = () => {
    if (comparisonPosts.length === 0) return null;

    return (
      <View style={styles.comparisonSection}>
        <View style={styles.sectionHeader}>
          <Text style={styles.sectionTitle}>
            <Text style={styles.sectionOr}>Or </Text>
            <Text style={styles.sectionThis}>This?</Text>
          </Text>
          <Text style={styles.sectionSubtitle}>Help others decide</Text>
        </View>
        {comparisonPosts.slice(0, 3).map((post) => {
          const imageA = post.imageAUrl || (post.imageAData ? `data:image/jpeg;base64,${post.imageAData}` : '');
          const imageB = post.imageBUrl || (post.imageBData ? `data:image/jpeg;base64,${post.imageBData}` : '');
          return (
            <ComparisonCard
              key={post.id}
              id={post.id}
              username={post.user.username || post.user.name || 'Anonymous'}
              imageA={imageA}
              imageB={imageB}
              question={post.question}
              occasions={post.occasions}
              votesA={post.votesA}
              votesB={post.votesB}
              totalVotes={post.votesA + post.votesB}
              userVote={post.myVote}
              createdAt={post.createdAt}
              onVote={(choice) => voteMutation.mutate({ postId: post.id, choice })}
              onUserPress={() => {}}
            />
          );
        })}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.headerTitle}>Community</Text>
          <Text style={styles.headerSubtitle}>Discover style inspiration</Text>
        </View>
        <View style={styles.headerActions}>
          {/* LAUNCH: Challenges trophy button hidden — re-enable when challenges go live */}
          <TouchableOpacity
            style={styles.headerButton}
            onPress={() => router.push('/notifications' as any)}
            activeOpacity={0.7}
          >
            <Ionicons name="notifications-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </View>

      {/* Filter Tabs */}
      <View style={styles.filterContainer}>
        {renderFilterButton('Recent', 'recent')}
        {renderFilterButton('Popular', 'popular')}
        {renderFilterButton('Top Rated', 'top-rated')}
        {renderFilterButton('Inner Circle', 'inner_circle')}
      </View>

      {/* Inner Circle empty state hint */}
      {filter === 'inner_circle' && outfits.length === 0 && !isLoading && (
        <View style={styles.innerCircleHint}>
          <Ionicons name="people-outline" size={32} color={Colors.textMuted} />
          <Text style={styles.innerCircleHintTitle}>Your inner circle is quiet</Text>
          <Text style={styles.innerCircleHintText}>
            Add people to your inner circle from their profiles, then share outfits with them.
          </Text>
        </View>
      )}

      {/* Feed */}
      <FlatList
        data={transformedOutfits}
        renderItem={({ item }) => (
          <OutfitFeedCard
            outfit={item}
            onPress={() => router.push(`/outfit/${item.id}` as any)}
          />
        )}
        keyExtractor={(item) => item.id}
        contentContainerStyle={styles.feedContent}
        showsVerticalScrollIndicator={false}
        ListHeaderComponent={renderComparisonSection()}
        refreshControl={
          <RefreshControl
            refreshing={isFetching && offset === 0}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
          />
        }
        onEndReached={handleLoadMore}
        onEndReachedThreshold={0.5}
        ListFooterComponent={renderFooter}
        ListEmptyComponent={renderEmpty}
        ListFooterComponentStyle={styles.listFooter}
      />

      {/* Guidelines Link */}
      <View style={styles.guidelinesFooter}>
        <TouchableOpacity
          onPress={() => router.push('/community-guidelines' as any)}
          activeOpacity={0.7}
        >
          <Text style={styles.guidelinesLink}>Community Guidelines</Text>
        </TouchableOpacity>
      </View>

      {/* Floating Action Buttons */}
      <TouchableOpacity
        style={[styles.fab, styles.fabSecondary]}
        onPress={() => {
          if (tier === 'free') {
            Alert.alert(
              'Plus Feature',
              'Giving community feedback requires a Plus or Pro subscription.',
              [
                { text: 'Not Now', style: 'cancel' },
                { text: 'Upgrade', onPress: () => router.push('/upgrade' as any) },
              ]
            );
            return;
          }
          router.push('/give-feedback' as any);
        }}
        activeOpacity={0.9}
      >
        <Ionicons name="heart-outline" size={24} color={Colors.white} />
      </TouchableOpacity>
      {/* LAUNCH: create-comparison FAB hidden — backend endpoint disabled at launch */}
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
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.sm,
  },
  headerActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  headerSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  filterButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
  },
  filterButtonActive: {
    backgroundColor: Colors.primary,
  },
  filterText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  filterTextActive: {
    color: Colors.white,
  },
  feedContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
  },
  loadingFooter: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },
  innerCircleHint: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.sm,
  },
  innerCircleHintTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    textAlign: 'center',
  },
  innerCircleHintText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  listFooter: {
    paddingBottom: 60, // Extra space for guidelines footer
  },
  guidelinesFooter: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.background,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    alignItems: 'center',
  },
  guidelinesLink: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  fab: {
    position: 'absolute',
    bottom: 80,
    right: Spacing.lg,
    width: 56,
    height: 56,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  fabSecondary: {
    bottom: 80, // create-comparison FAB removed — this is now the only FAB
    backgroundColor: Colors.secondary,
  },
  comparisonSection: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'baseline',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    marginTop: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
  },
  sectionOr: {
    color: Colors.text,
    fontWeight: '700',
  },
  sectionThis: {
    color: Colors.primary,
    fontStyle: 'italic',
    fontWeight: '700',
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
