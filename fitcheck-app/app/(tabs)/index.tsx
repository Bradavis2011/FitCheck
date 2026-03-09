import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Image, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { TabActions } from '@react-navigation/core';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Fonts, FontSize } from '../../src/constants/theme';
import { getHeroCopy } from '../../src/constants/archetypeHero';
import OutfitCard from '../../src/components/OutfitCard';
import OrThisLogo from '../../src/components/OrThisLogo';
import DailyLookCard from '../../src/components/DailyLookCard';
import StylistCard from '../../src/components/StylistCard';
import EventCountdownCard from '../../src/components/EventCountdownCard';
import StyleJournalPreviewCard from '../../src/components/StyleJournalPreviewCard';

const EDITORIAL_IMAGES = [
  require('../../assets/images/fabian-kunzel-zeller-LLXs757C7DA-unsplash.jpg'),
  require('../../assets/images/fabian-kunzel-zeller-Ir7tmdZ6dWU-unsplash.jpg'),
  require('../../assets/images/fabian-kunzel-zeller-xZokPso8xys-unsplash.jpg'),
  require('../../assets/images/fabian-kunzel-zeller-Kd0oUzb2Bfg-unsplash.jpg'),
];
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { useOutfits, useUserStats, useToggleFavorite, useCommunityFeed, useUser, useNotifications, useInsights, useHomeContext } from '../../src/hooks/useApi';
import ErrorState from '../../src/components/ErrorState';
import UserAvatar from '../../src/components/UserAvatar';

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const { tier } = useSubscriptionStore();
  const { data: outfitsData, refetch: refetchOutfits, isError: isOutfitsError, isLoading: isOutfitsLoading } = useOutfits({ limit: 5 });
  const { data: stats, refetch: refetchStats } = useUserStats();
  const { data: communityData, refetch: refetchCommunity } = useCommunityFeed({ filter: 'recent', limit: 3 });
  const toggleFavoriteMutation = useToggleFavorite();
  const { data: userProfile } = useUser();
  const { data: notificationsData } = useNotifications(true);
  const unreadCount = notificationsData?.unreadCount ?? 0;
  const [refreshing, setRefreshing] = useState(false);

  const { refetch: refetchInsights } = useInsights(1);
  const { refetch: refetchHomeContext } = useHomeContext();

  // A7: archetype-personalized hero copy
  const heroContent = getHeroCopy((userProfile as any)?.topArchetype);

  const outfits = outfitsData?.outfits || [];
  const communityOutfits = (communityData?.outfits || []).map((outfit) => ({
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

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        refetchOutfits(),
        refetchStats(),
        refetchCommunity(),
        refetchInsights(),
        refetchHomeContext(),
      ]);
    } finally {
      setRefreshing(false);
    }
  };

  const getInitials = () => {
    const name = user?.name || user?.email?.split('@')[0] || 'User';
    const parts = name.split(' ');
    if (parts.length >= 2) return parts[0][0] + parts[1][0];
    return name.slice(0, 2).toUpperCase();
  };

  const handleToggleFavorite = async (outfitId: string) => {
    try {
      await toggleFavoriteMutation.mutateAsync(outfitId);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
    }
  };

  const handleOutfitLongPress = (outfitId: string) => {
    Alert.alert('', '', [
      { text: 'Compare Outfits', onPress: () => router.push(`/compare?preselectA=${outfitId}` as any) },
      { text: 'View Feedback', onPress: () => router.push(`/feedback?outfitId=${outfitId}` as any) },
      { text: 'Cancel', style: 'cancel' },
    ]);
  };

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        contentContainerStyle={styles.scroll}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={handleRefresh}
            tintColor={Colors.primary}
            colors={[Colors.primary]}
          />
        }
      >
        {/* Header — logo left, bell + avatar right */}
        <View style={styles.header}>
          <OrThisLogo size={26} />
          <View style={styles.headerRight}>
            <TouchableOpacity
              style={styles.bellButton}
              onPress={() => router.push('/notifications' as any)}
              activeOpacity={0.8}
            >
              <Ionicons name="notifications-outline" size={24} color={Colors.text} />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{unreadCount > 9 ? '9+' : unreadCount}</Text>
                </View>
              )}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => navigation.dispatch(TabActions.jumpTo('profile'))} activeOpacity={0.8}>
              <UserAvatar
                imageUri={userProfile?.profileImageUrl}
                initials={getInitials()}
                size={44}
              />
            </TouchableOpacity>
          </View>
        </View>

        {/* Editorial prompt area */}
        <View style={styles.heroSection}>
          <Text style={styles.heroPrompt}>{heroContent.prompt}</Text>
          <Text style={styles.heroSub}>{heroContent.sub}</Text>

          {/* Primary CTA — sharp corners, coral, uppercase */}
          <TouchableOpacity
            style={styles.ctaButton}
            activeOpacity={0.85}
            onPress={() => router.push('/(tabs)/camera')}
          >
            <Ionicons name="camera" size={18} color={Colors.white} />
            <Text style={styles.ctaButtonText}>Check an outfit</Text>
          </TouchableOpacity>

          {/* Daily checks counter — minimal */}
          {stats && (
            <Text style={styles.checksRemaining}>
              {stats.dailyChecksRemaining} of {stats.dailyChecksLimit} remaining
            </Text>
          )}
        </View>

        {/* Today's Look — AI outfit from wardrobe + weather (Plus/Pro) or lookbook (free) */}
        <DailyLookCard />

        {/* Lookbook strip — shown for free tier as fallback (DailyLookCard returns null for paid) */}
        {tier === 'free' && (
          <View style={styles.lookbookSection}>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.lookbookScroll}
            >
              {EDITORIAL_IMAGES.map((src, i) => (
                <Image key={i} source={src} style={styles.lookbookImage} resizeMode="cover" />
              ))}
            </ScrollView>
            <TouchableOpacity onPress={() => Linking.openURL('https://www.instagram.com/kuenzelzeller')}>
              <Text style={styles.photoCredit}>Photos by Fabian Künzel-Zeller · @kuenzelzeller</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Stylist Card — agent activity + narrative + Ask Noa link */}
        <StylistCard />

        {/* Event Countdown — upcoming events with Plan with Noa */}
        <EventCountdownCard />

        {/* Recent section */}
        {isOutfitsError ? (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Recent</Text>
            </View>
            <ErrorState onRetry={refetchOutfits} />
          </View>
        ) : outfits.length === 0 && !isOutfitsLoading && !isOutfitsError ? (
          <View style={styles.emptySection}>
            <Text style={styles.sectionLabel}>Recent</Text>
            <View style={styles.rule} />
            <Text style={styles.emptyTitle}>No outfits yet.</Text>
            <Text style={styles.emptySubtitle}>Check your first look to start building your style archive.</Text>
            <TouchableOpacity
              style={styles.emptyButton}
              onPress={() => router.push('/(tabs)/camera')}
              activeOpacity={0.85}
            >
              <Ionicons name="camera" size={16} color={Colors.white} />
              <Text style={styles.emptyButtonText}>Check an outfit</Text>
            </TouchableOpacity>
          </View>
        ) : outfits.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Recent</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.seeAll}>Archive</Text>
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScroll}
            >
              {outfits.map((outfit) => {
                let imageUri = '';
                if (outfit.thumbnailData || outfit.imageData) {
                  const base64Data = outfit.thumbnailData || outfit.imageData;
                  imageUri = base64Data?.startsWith('data:')
                    ? base64Data
                    : `data:image/jpeg;base64,${base64Data}`;
                } else if (outfit.imageUrl) {
                  imageUri = outfit.imageUrl;
                }

                return (
                  <View key={outfit.id} style={styles.recentCard}>
                    <OutfitCard
                      imageUrl={imageUri}
                      score={outfit.aiScore || 0}
                      occasions={outfit.occasions || []}
                      isFavorite={outfit.isFavorite}
                      onPress={() => router.push(`/feedback?outfitId=${outfit.id}` as any)}
                      onLongPress={() => handleOutfitLongPress(outfit.id)}
                      onFavoritePress={() => handleToggleFavorite(outfit.id)}
                    />
                  </View>
                );
              })}
            </ScrollView>
          </View>
        )}

        {/* Community — shared outfits preview */}
        <View style={styles.communitySection}>
          <View style={styles.sectionDivider} />
          <View style={styles.communityBlock}>
            <Text style={styles.sectionLabel}>Community</Text>
            <View style={styles.rule} />
            <Text style={styles.communityTitle}>What they're wearing.</Text>
            <Text style={styles.communitySubtitle}>Score real looks. Get scored back.</Text>
          </View>
          {communityOutfits.length > 0 ? (
            <>
              <ScrollView
                horizontal
                showsHorizontalScrollIndicator={false}
                contentContainerStyle={styles.communityCarouselScroll}
              >
                {communityOutfits.map((outfit) => {
                  const rawThumb = outfit.thumbnailData;
                  const imageUri = rawThumb
                    ? (rawThumb.startsWith('data:') ? rawThumb : `data:image/jpeg;base64,${rawThumb}`)
                    : outfit.imageUrl || null;
                  return (
                    <TouchableOpacity
                      key={outfit.id}
                      style={styles.communityCarouselCard}
                      onPress={() => router.push(`/outfit/${outfit.id}` as any)}
                      activeOpacity={0.9}
                    >
                      {imageUri ? (
                        <Image
                          source={{ uri: imageUri }}
                          style={styles.communityCarouselImage}
                          resizeMode="cover"
                        />
                      ) : (
                        <View style={[styles.communityCarouselImage, styles.communityCarouselPlaceholder]}>
                          <Ionicons name="shirt-outline" size={28} color={Colors.textMuted} />
                        </View>
                      )}
                      {outfit.score > 0 && (
                        <View style={styles.communityCarouselBadge}>
                          <Text style={styles.communityCarouselBadgeText}>{outfit.score.toFixed(1)}</Text>
                        </View>
                      )}
                      <Text style={styles.communityCarouselUser} numberOfLines={1}>@{outfit.username}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
              <TouchableOpacity
                style={styles.seeMoreLink}
                onPress={() => router.push('/(tabs)/community')}
              >
                <Text style={styles.seeAll}>See the feed →</Text>
              </TouchableOpacity>
            </>
          ) : (
            <View style={styles.communityEmpty}>
              <Text style={styles.communityEmptyText}>
                No looks shared yet. Be the first.
              </Text>
            </View>
          )}
        </View>

        {/* Style Journal preview */}
        <StyleJournalPreviewCard />
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  scroll: {
    paddingBottom: Spacing.xxl,
  },
  // Header
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  bellButton: {
    position: 'relative',
    padding: 4,
  },
  badge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: Colors.primary,
    borderRadius: 9999,
    minWidth: 16,
    height: 16,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 3,
  },
  badgeText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 9,
    color: Colors.white,
    lineHeight: 11,
  },
  // Hero editorial prompt
  heroSection: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.xl,
    paddingBottom: Spacing.xxl,
  },
  heroPrompt: {
    fontFamily: Fonts.serif,
    fontSize: 36,
    color: Colors.text,
    lineHeight: 44,
    marginBottom: Spacing.sm,
  },
  heroSub: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.textMuted,
    marginBottom: Spacing.xl,
  },
  ctaButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: 0, // sharp — editorial spec
    paddingVertical: 16,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  ctaButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  checksRemaining: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
  // Editorial lookbook strip
  lookbookSection: {
    marginBottom: Spacing.xl,
  },
  lookbookScroll: {
    paddingHorizontal: Spacing.lg,
    gap: 6,
  },
  lookbookImage: {
    width: 140,
    height: 200,
    borderRadius: 8,
  },
  photoCredit: {
    fontFamily: Fonts.sans,
    fontSize: 10,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: 4,
    paddingHorizontal: Spacing.lg,
  },
  // Section divider
  sectionDivider: {
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.08)',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  // AI one-liner
  aiSubtleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    gap: Spacing.xs,
    marginBottom: Spacing.md,
  },
  aiSubtleDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  aiSubtleText: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  // Recent section
  section: {
    marginBottom: Spacing.xxl,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  sectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
  },
  seeAll: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.primary,
  },
  recentScroll: {
    paddingHorizontal: Spacing.lg,
    gap: Spacing.sm,
  },
  recentCard: {
    width: 160,
  },
  // Community
  communitySection: {
    marginBottom: Spacing.xxl,
  },
  communityBlock: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  communityTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  communitySubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  seeMoreLink: {
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.sm,
  },
  communityCarouselScroll: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.sm,
    gap: Spacing.sm,
  },
  communityCarouselCard: {
    width: 120,
    position: 'relative',
  },
  communityCarouselImage: {
    width: 120,
    height: 160,
    borderRadius: 8,
    backgroundColor: Colors.surfaceLight,
  },
  communityCarouselPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityCarouselBadge: {
    position: 'absolute',
    top: 0,
    right: 0,
    backgroundColor: 'rgba(26,26,26,0.75)',
    paddingHorizontal: 6,
    paddingVertical: 3,
  },
  communityCarouselBadgeText: {
    fontFamily: Fonts.serif,
    color: '#fff',
    fontSize: 11,
  },
  communityCarouselUser: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 4,
    textAlign: 'center',
  },
  communityEmpty: {
    paddingHorizontal: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  communityEmptyText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    fontStyle: 'italic',
  },
  // Empty state (Recent)
  emptySection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
    marginBottom: Spacing.xl,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  emptySubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  emptyButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.primary,
    borderRadius: 0,
    paddingVertical: 14,
    paddingHorizontal: Spacing.lg,
    alignSelf: 'flex-start',
  },
  emptyButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  rule: {
    width: 60,
    height: 1,
    backgroundColor: '#E85D4C',
    marginBottom: Spacing.md,
  },
});
