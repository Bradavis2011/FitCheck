import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  RefreshControl,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius, Fonts } from '../../src/constants/theme';
import OutfitFeedCard from '../../src/components/OutfitFeedCard';
import ComparisonCard from '../../src/components/ComparisonCard';
import { useCommunityFeed, useComparisonFeed, useVoteOnComparison } from '../../src/hooks/useApi';

type FeedFilter = 'recent' | 'popular' | 'top-rated' | 'inner_circle';

const FILTERS: { label: string; value: FeedFilter }[] = [
  { label: 'Recent', value: 'recent' },
  { label: 'Popular', value: 'popular' },
  { label: 'Top Rated', value: 'top-rated' },
  { label: 'Following', value: 'inner_circle' },
];

export default function CommunityScreen() {
  const router = useRouter();
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
    if (!isFetching && hasMore) setOffset(offset + 20);
  };

  const handleFilterChange = (newFilter: FeedFilter) => {
    setFilter(newFilter);
    setOffset(0);
  };

  const transformedOutfits = outfits.map((outfit) => ({
    id: outfit.id,
    imageUrl: outfit.thumbnailUrl || outfit.imageUrl || '',
    thumbnailData: outfit.thumbnailData,
    score: outfit.aiScore ?? 0,
    occasions: outfit.occasions,
    feedbackCount: outfit._count.communityFeedback,
    username: outfit.user.username || outfit.user.name || 'Anonymous',
    createdAt: outfit.createdAt,
    aiFeedback: (outfit as any).aiFeedback ?? null,
  }));

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

    if (filter === 'inner_circle') {
      return (
        <View style={styles.emptyState}>
          <Text style={styles.emptyTitle}>Your circle is quiet.</Text>
          <Text style={styles.emptyText}>
            Follow people from their profiles to see their outfit shares here.
          </Text>
        </View>
      );
    }

    return (
      <View style={styles.emptyState}>
        <Text style={styles.emptyTitle}>No looks yet.</Text>
        <Text style={styles.emptyText}>
          Be the first to share — the community scores back.
        </Text>
      </View>
    );
  };

  const renderComparisonSection = () => {
    if (comparisonPosts.length === 0) return null;

    return (
      <View style={styles.comparisonSection}>
        <View style={styles.comparisonHeader}>
          <Text style={styles.sectionLabel}>Or This?</Text>
          <View style={styles.sectionRule} />
          <Text style={styles.comparisonTitle}>
            <Text style={{ fontFamily: Fonts.sansMedium, color: Colors.text }}>Or </Text>
            <Text style={{ fontFamily: Fonts.serifItalic, color: Colors.primary }}>This?</Text>
          </Text>
          <Text style={styles.comparisonSubtitle}>Help people decide.</Text>
        </View>
        {comparisonPosts.slice(0, 3).map((post) => {
          const toUri = (url?: string | null, data?: string | null) =>
            url || (data ? (data.startsWith('data:') ? data : `data:image/jpeg;base64,${data}`) : '');
          const imageA = toUri(post.imageAUrl, post.imageAData);
          const imageB = toUri(post.imageBUrl, post.imageBData);
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
        <View style={styles.headerLeft}>
          <Text style={styles.eyebrow}>Community</Text>
          <View style={styles.headerRule} />
          <Text style={styles.headerTitle}>What they're wearing.</Text>
        </View>
        <TouchableOpacity
          style={styles.headerButton}
          onPress={() => router.push('/notifications' as any)}
          activeOpacity={0.7}
        >
          <Ionicons name="notifications-outline" size={20} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Filter chips */}
      <View style={styles.filterRow}>
        {FILTERS.map(({ label, value }) => (
          <TouchableOpacity
            key={value}
            style={[styles.filterChip, filter === value && styles.filterChipActive]}
            onPress={() => handleFilterChange(value)}
            activeOpacity={0.7}
          >
            <Text style={[styles.filterLabel, filter === value && styles.filterLabelActive]}>
              {label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

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
      />

      {/* Give feedback FAB */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => router.push('/give-feedback' as any)}
        activeOpacity={0.9}
      >
        <Ionicons name="heart-outline" size={22} color={Colors.white} />
      </TouchableOpacity>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },

  // ── Header ──────────────────────────────────────────────────────────────────
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  headerLeft: {
    flex: 1,
  },
  eyebrow: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  headerRule: {
    width: 60,
    height: 1,
    backgroundColor: Colors.primary,
    marginBottom: 10,
  },
  headerTitle: {
    fontFamily: Fonts.serif,
    fontSize: 26,
    color: Colors.text,
    lineHeight: 32,
  },
  headerButton: {
    width: 40,
    height: 40,
    borderRadius: 0,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    marginTop: 4,
  },

  // ── Filter chips ─────────────────────────────────────────────────────────────
  filterRow: {
    flexDirection: 'row',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  filterChip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  filterChipActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  filterLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 10,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.text,
  },
  filterLabelActive: {
    color: Colors.white,
  },

  // ── Feed ─────────────────────────────────────────────────────────────────────
  feedContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: 100,
  },

  // ── Comparison section ────────────────────────────────────────────────────────
  comparisonSection: {
    marginBottom: Spacing.lg,
  },
  comparisonHeader: {
    paddingHorizontal: Spacing.sm,
    paddingBottom: Spacing.md,
    paddingTop: Spacing.sm,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  sectionRule: {
    width: 60,
    height: 1,
    backgroundColor: Colors.primary,
    marginBottom: 10,
  },
  comparisonTitle: {
    fontSize: 22,
    marginBottom: 4,
  },
  comparisonSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textMuted,
  },

  // ── Empty states ──────────────────────────────────────────────────────────────
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 22,
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 21,
  },

  // ── Loading ───────────────────────────────────────────────────────────────────
  loadingFooter: {
    paddingVertical: Spacing.lg,
    alignItems: 'center',
  },

  // ── FAB ──────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute',
    bottom: 32,
    right: Spacing.lg,
    width: 52,
    height: 52,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
});
