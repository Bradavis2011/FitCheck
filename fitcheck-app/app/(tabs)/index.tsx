import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, RefreshControl, Share, Image, Linking } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, Fonts } from '../../src/constants/theme';
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
import { useOutfits, useUserStats, useToggleFavorite, useCommunityFeed, useReferralStats } from '../../src/hooks/useApi';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { tier } = useSubscriptionStore();
  const { data: outfitsData, refetch: refetchOutfits } = useOutfits({ limit: 5 });
  const { data: stats, refetch: refetchStats } = useUserStats();
  const { data: communityData, refetch: refetchCommunity } = useCommunityFeed({ filter: 'recent', limit: 3 });
  const toggleFavoriteMutation = useToggleFavorite();
  const { data: referralStats } = useReferralStats();
  const [refreshing, setRefreshing] = useState(false);

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
      await Promise.all([refetchOutfits(), refetchStats(), refetchCommunity()]);
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
        {/* Header — logo left, avatar right */}
        <View style={styles.header}>
          <OrThisLogo size={26} />
          <TouchableOpacity style={styles.avatar} onPress={() => router.navigate('/(tabs)/profile' as any)}>
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </TouchableOpacity>
        </View>

        {/* Editorial prompt area */}
        <View style={styles.heroSection}>
          <Text style={styles.heroPrompt}>What are you{'\n'}wearing today?</Text>
          <Text style={styles.heroSub}>No sugarcoating. Honest AI feedback.</Text>

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
              {stats.dailyChecksRemaining}/{stats.dailyChecksLimit} checks remaining today
            </Text>
          )}
        </View>

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
        {outfits.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionLabel}>Recent</Text>
              <TouchableOpacity onPress={() => router.push('/(tabs)/history')}>
                <Text style={styles.seeAll}>See archive</Text>
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
                      onFavoritePress={() => handleToggleFavorite(outfit.id)}
                    />
                  </View>
                );
              })}
            </ScrollView>
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

        {/* Or This? — feature promo module */}
        <View style={styles.orThisSection}>
          <View style={styles.sectionDivider} />
          <View style={styles.orThisBlock}>
            <Text style={styles.sectionLabel}>Or This?</Text>
            <View style={styles.rule} />
            <Text style={styles.orThisTitle}>
              <Text style={{ fontFamily: Fonts.serif }}>Or </Text>
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

        {/* Upgrade — editorial style (free tier only) */}
        {tier === 'free' && (
          <View style={styles.upgradeSection}>
            <View style={styles.sectionDivider} />
            <View style={styles.upgradeBlock}>
              <Text style={styles.upgradeSectionLabel}>Plus</Text>
              <View style={styles.rule} />
              <Text style={styles.upgradeTitle}>Unlimited checks. Zero limits.</Text>
              <Text style={styles.upgradeSubtitle}>Ad-free, full history, premium feedback.</Text>
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
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 9999,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.primaryAlpha30,
  },
  avatarText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    color: Colors.primary,
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
    borderRadius: 4,
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
    marginBottom: Spacing.xl,
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
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.md,
  },
  // Or This? promo
  orThisSection: {
    marginBottom: Spacing.lg,
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
    marginBottom: Spacing.lg,
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
    backgroundColor: 'rgba(0,0,0,0.12)',
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
