import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Share, Image, Linking, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useNavigation } from '@react-navigation/native';
import { TabActions } from '@react-navigation/core';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Fonts } from '../../src/constants/theme';
import { getHeroCopy } from '../../src/constants/archetypeHero';
import OutfitCard from '../../src/components/OutfitCard';
import OutfitFeedCard from '../../src/components/OutfitFeedCard';
import OrThisLogo from '../../src/components/OrThisLogo';
import WardrobeProgressCard from '../../src/components/WardrobeProgressCard';

const EDITORIAL_IMAGES = [
  require('../../assets/images/fabian-kunzel-zeller-LLXs757C7DA-unsplash.jpg'),
  require('../../assets/images/fabian-kunzel-zeller-Ir7tmdZ6dWU-unsplash.jpg'),
  require('../../assets/images/fabian-kunzel-zeller-xZokPso8xys-unsplash.jpg'),
  require('../../assets/images/fabian-kunzel-zeller-Kd0oUzb2Bfg-unsplash.jpg'),
];
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { useOutfits, useUserStats, useToggleFavorite, useCommunityFeed, useReferralStats, useUser, useNotifications, useYourWeek } from '../../src/hooks/useApi';
import ErrorState from '../../src/components/ErrorState';
import UserAvatar from '../../src/components/UserAvatar';

// ── Your Week helpers ─────────────────────────────────────────────────────────

function weatherIcon(condition: string): 'sunny-outline' | 'partly-sunny-outline' | 'cloud-outline' | 'rainy-outline' | 'snow-outline' | 'thunderstorm-outline' {
  switch (condition) {
    case 'sunny':        return 'sunny-outline';
    case 'partly_cloudy': return 'partly-sunny-outline';
    case 'cloudy':       return 'cloud-outline';
    case 'rainy':        return 'rainy-outline';
    case 'snowy':        return 'snow-outline';
    case 'stormy':       return 'thunderstorm-outline';
    default:             return 'partly-sunny-outline';
  }
}

function formatEventDate(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const diff = Math.round((date.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
  if (diff === 0) return 'Today';
  if (diff === 1) return 'Tomorrow';
  return date.toLocaleDateString('en-US', { weekday: 'long', month: 'short', day: 'numeric' });
}

export default function HomeScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const user = useAuthStore((s) => s.user);
  const { tier } = useSubscriptionStore();
  const { data: outfitsData, refetch: refetchOutfits, isError: isOutfitsError, isLoading: isOutfitsLoading } = useOutfits({ limit: 5 });
  const { data: stats, refetch: refetchStats } = useUserStats();
  const { data: communityData, refetch: refetchCommunity } = useCommunityFeed({ filter: 'recent', limit: 3 });
  const toggleFavoriteMutation = useToggleFavorite();
  const { data: referralStats } = useReferralStats();
  const { data: userProfile } = useUser();
  const { data: notificationsData } = useNotifications(true);
  const unreadCount = notificationsData?.unreadCount ?? 0;
  const [refreshing, setRefreshing] = useState(false);

  const isPlus = tier === 'plus' || tier === 'pro';
  const { data: weekData, refetch: refetchWeek } = useYourWeek(isPlus);

  // A7: archetype-personalized hero copy
  const heroContent = getHeroCopy((userProfile as any)?.topArchetype);

  // Feature discovery hint — contextual based on total outfit count
  const totalOutfits = stats?.totalOutfits ?? 0;
  const featureHint = totalOutfits >= 10
    ? { label: 'Insights', title: 'Explore your Style DNA', sub: 'Color analysis and AI recommendations tailored to you.', route: '/style-profile' }
    : totalOutfits >= 3
    ? { label: 'Discover', title: 'Compare two outfits', sub: "Can't decide? Get an honest AI verdict.", route: '/compare' }
    : totalOutfits >= 1
    ? { label: 'Personalize', title: 'Set your style preferences', sub: 'Help the AI learn your taste faster.', route: '/style-preferences' }
    : null;

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
      await Promise.all([refetchOutfits(), refetchStats(), refetchCommunity(), ...(isPlus ? [refetchWeek()] : [])]);
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

  const handleInvite = async () => {
    const inviteLink = referralStats?.link ?? 'https://orthis.app';
    try {
      await Share.share({
        message: `Check out Or This? — AI outfit feedback that tells you exactly what works and what doesn't. Try it free: ${inviteLink}`,
        url: inviteLink,
      });
    } catch {
      // user dismissed — no action needed
    }
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

        {/* Your Week — Plus/Pro only */}
        {isPlus && weekData && (weekData.upcomingEvents.length > 0 || weekData.weather) && (
          <View style={styles.yourWeekSection}>
            <View style={styles.sectionDivider} />
            <View style={styles.yourWeekHeader}>
              <Text style={styles.sectionLabel}>Your Week</Text>
              <View style={styles.rule} />
            </View>

            {/* Weather row */}
            {weekData.weather && (
              <View style={styles.weatherRow}>
                <Ionicons
                  name={weatherIcon(weekData.weather.condition)}
                  size={20}
                  color={Colors.textMuted}
                />
                <Text style={styles.weatherText}>
                  {weekData.weather.tempFahrenheit}°F · {weekData.weather.description}
                </Text>
              </View>
            )}

            {/* Upcoming events */}
            {weekData.upcomingEvents.map((ev) => (
              <View key={ev.id} style={styles.weekEventRow}>
                <View style={styles.weekEventDot} />
                <View style={styles.weekEventContent}>
                  <Text style={styles.weekEventOccasion}>{ev.occasion}</Text>
                  {ev.eventDate && (
                    <Text style={styles.weekEventDate}>
                      {formatEventDate(ev.eventDate)}
                    </Text>
                  )}
                </View>
                {ev.outfitScore != null && (
                  <Text style={styles.weekEventScore}>{ev.outfitScore.toFixed(1)}</Text>
                )}
              </View>
            ))}

            {/* Suggestions */}
            {weekData.suggestions.length > 0 && (
              <Text style={styles.weekSuggestion}>{weekData.suggestions[weekData.suggestions.length - 1]}</Text>
            )}
          </View>
        )}

        {/* Editorial image strip — horizontal lookbook */}
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

        {/* Editorial rule divider */}
        <View style={styles.sectionDivider} />

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

        {/* Or This? — compare promo (moved up for visibility) */}
        <View style={styles.orThisSection}>
          <View style={styles.sectionDivider} />
          <View style={styles.orThisBlock}>
            <Text style={styles.sectionLabel}>Or This?</Text>
            <View style={styles.rule} />
            <Text style={styles.orThisTitle}>
              <Text style={{ fontFamily: Fonts.sansMedium }}>Or </Text>
              <Text style={{ fontFamily: Fonts.serifItalic, color: Colors.primary }}>This?</Text>
            </Text>
            <Text style={styles.orThisSubtitle}>Can't decide between two looks? Get an honest verdict.</Text>
            <TouchableOpacity
              style={styles.orThisButton}
              onPress={() => router.push('/compare' as any)}
            >
              <Ionicons name="git-compare-outline" size={16} color={Colors.primary} />
              <Text style={styles.orThisButtonText}>Compare Two Outfits</Text>
            </TouchableOpacity>
          </View>
        </View>

        {/* Feature discovery hint — contextual, based on outfit count */}
        {featureHint && (
          <View style={styles.hintSection}>
            <View style={styles.sectionDivider} />
            <TouchableOpacity
              style={styles.hintBlock}
              onPress={() => router.push(featureHint.route as any)}
              activeOpacity={0.8}
            >
              <View style={styles.hintContent}>
                <Text style={styles.sectionLabel}>{featureHint.label}</Text>
                <Text style={styles.hintTitle}>{featureHint.title}</Text>
                <Text style={styles.hintSub}>{featureHint.sub}</Text>
              </View>
              <Ionicons name="arrow-forward" size={18} color={Colors.primary} />
            </TouchableOpacity>
          </View>
        )}

        {/* Wardrobe Progress */}
        <View style={styles.wardrobeSection}>
          <WardrobeProgressCard />
        </View>

        {/* Community — shared outfits preview */}
        {communityOutfits.length > 0 && (
          <View style={styles.communitySection}>
            <View style={styles.sectionDivider} />
            <View style={styles.communityBlock}>
              <Text style={styles.sectionLabel}>Community</Text>
              <View style={styles.rule} />
              <Text style={styles.communityTitle}>Rate each other's fits</Text>
              <Text style={styles.communitySubtitle}>Real feedback from real people</Text>
            </View>
            {communityOutfits.map((outfit) => (
              <View key={outfit.id} style={{ paddingHorizontal: Spacing.lg, marginBottom: Spacing.sm }}>
                <OutfitFeedCard
                  outfit={outfit}
                  onPress={() => router.push(`/outfit/${outfit.id}` as any)}
                />
              </View>
            ))}
            <TouchableOpacity
              style={styles.seeMoreLink}
              onPress={() => router.push('/(tabs)/community')}
            >
              <Text style={styles.seeAll}>See community feed</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Upgrade — editorial style (free tier only) */}
        {tier === 'free' && (
          <View style={styles.upgradeSection}>
            <View style={styles.sectionDivider} />
            <View style={styles.upgradeBlock}>
              <Text style={styles.upgradeSectionLabel}>Plus</Text>
              <View style={styles.rule} />
              <Text style={styles.upgradeTitle}>Unlimited verdicts.</Text>
              <Text style={styles.upgradeSubtitle}>No daily limit. Full style intelligence.</Text>
              <TouchableOpacity
                style={styles.upgradeButton}
                onPress={() => router.push('/upgrade' as any)}
              >
                <Text style={styles.upgradeButtonText}>See Plans</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* Invite — text link */}
        <TouchableOpacity style={styles.inviteRow} onPress={handleInvite}>
          <Ionicons name="share-outline" size={16} color={Colors.primary} />
          <Text style={styles.inviteText}>Invite a friend — earn bonus checks</Text>
        </TouchableOpacity>
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
  },
  // Wardrobe
  wardrobeSection: {
    marginBottom: Spacing.xxl,
  },
  // Feature hint
  hintSection: {
    marginBottom: Spacing.xxl,
  },
  hintBlock: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
  },
  hintContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  hintTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: Colors.text,
    marginBottom: 2,
  },
  hintSub: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textMuted,
  },
  // Or This? promo
  orThisSection: {
    marginBottom: Spacing.xxl,
  },
  orThisBlock: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  orThisTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  orThisSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  orThisButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    alignSelf: 'flex-start',
  },
  orThisButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.primary,
  },
  // Upgrade block
  upgradeSection: {
    marginBottom: Spacing.xxl,
  },
  upgradeBlock: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  upgradeSectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  rule: {
    width: 60,
    height: 1,
    backgroundColor: '#E85D4C',
    marginBottom: Spacing.md,
  },
  upgradeTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.text,
    marginBottom: Spacing.xs,
  },
  upgradeSubtitle: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
    marginBottom: Spacing.lg,
  },
  upgradeButton: {
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.primary,
    paddingVertical: 12,
    paddingHorizontal: Spacing.lg,
    alignSelf: 'flex-start',
  },
  upgradeButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.primary,
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
  // Your Week
  yourWeekSection: {
    marginBottom: Spacing.xxl,
  },
  yourWeekHeader: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  weatherRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  weatherText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textMuted,
  },
  weekEventRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: Spacing.lg,
    paddingVertical: 10,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,0,0,0.06)',
  },
  weekEventDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
    marginRight: Spacing.md,
  },
  weekEventContent: {
    flex: 1,
  },
  weekEventOccasion: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: Colors.text,
  },
  weekEventDate: {
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
    marginTop: 1,
  },
  weekEventScore: {
    fontFamily: Fonts.serif,
    fontSize: 16,
    color: Colors.primary,
  },
  weekSuggestion: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    paddingHorizontal: Spacing.lg,
    paddingTop: Spacing.md,
    fontStyle: 'italic',
  },
  // Invite
  inviteRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    marginTop: Spacing.sm,
  },
  inviteText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 14,
    color: Colors.text,
  },
});
