import { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, RefreshControl, Share } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../../src/constants/theme';
import OutfitCard from '../../src/components/OutfitCard';
import AdBanner from '../../src/components/AdBanner';
import { getTimeGreeting } from '../../src/lib/mockData';
import { useAuthStore } from '../../src/stores/authStore';
import { useSubscriptionStore } from '../../src/stores/subscriptionStore';
import { useOutfits, useUserStats, useToggleFavorite, useDailyGoals } from '../../src/hooks/useApi';

export default function HomeScreen() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const { tier } = useSubscriptionStore();
  const { data: outfitsData, isError: outfitsError, refetch: refetchOutfits } = useOutfits({ limit: 5 });
  const { data: stats, isError: statsError, refetch: refetchStats } = useUserStats();
  const { data: dailyGoals, refetch: refetchGoals } = useDailyGoals();
  const toggleFavoriteMutation = useToggleFavorite();
  const [refreshing, setRefreshing] = useState(false);

  const outfits = outfitsData?.outfits || [];
  const firstName = user?.name?.split(' ')[0] || 'there';
  const greeting = getTimeGreeting();

  const handleRefresh = async () => {
    setRefreshing(true);
    try {
      await Promise.all([refetchOutfits(), refetchStats(), refetchGoals()]);
    } finally {
      setRefreshing(false);
    }
  };

  const getInitials = () => {
    const name = user?.name || user?.email?.split('@')[0] || 'User';
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.slice(0, 2).toUpperCase();
  };

  const handleInvite = async () => {
    try {
      await Share.share({
        message: "Check out Or This? — the AI-powered outfit feedback app that tells you exactly what works and what doesn't. Try it free: https://orthis.app",
        url: 'https://orthis.app',
      });
    } catch {
      // user dismissed share sheet — no action needed
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
        {/* Header */}
        <View style={styles.header}>
          <View>
            <Text style={styles.greeting}>{greeting}, {firstName}</Text>
            <Text style={styles.subtitle}>Ready for your outfit check?</Text>
          </View>
          <TouchableOpacity
            style={styles.avatar}
            onPress={() => router.push('/(tabs)/profile')}
          >
            <Text style={styles.avatarText}>{getInitials()}</Text>
          </TouchableOpacity>
        </View>

        {/* Main CTA */}
        <TouchableOpacity
          style={styles.ctaCard}
          activeOpacity={0.95}
          onPress={() => router.push('/(tabs)/camera')}
        >
          <LinearGradient
            colors={[Colors.primary, Colors.secondary]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.ctaIcon}
          >
            <Ionicons name="camera" size={28} color={Colors.white} />
          </LinearGradient>
          <View style={styles.ctaText}>
            <View style={styles.ctaTitleRow}>
              <Text style={styles.ctaTitle}>Ready to check your outfit?</Text>
              <Ionicons name="sparkles" size={16} color={Colors.primary} />
            </View>
            <Text style={styles.ctaSubtitle}>Take a photo and get instant AI feedback</Text>
          </View>
          <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
        </TouchableOpacity>

        {/* Daily checks counter */}
        <View style={styles.dailyChecks}>
          {statsError ? (
            <Text style={[styles.dailyChecksText, { color: Colors.textMuted }]}>
              Couldn't load check count
            </Text>
          ) : (
            <Text style={styles.dailyChecksText}>
              Today's checks: {stats ? `${stats.dailyChecksRemaining}/${stats.dailyChecksLimit}` : '3/3'} remaining
            </Text>
          )}
        </View>

        {/* Streak & Daily Goals widget */}
        {dailyGoals && (dailyGoals.currentStreak > 0 || dailyGoals.feedbacksGiven > 0) && (
          <View style={styles.goalsRow}>
            {dailyGoals.currentStreak > 0 && (
              <View style={styles.goalChip}>
                <Ionicons name="flame" size={14} color={Colors.warning} />
                <Text style={styles.goalChipText}>
                  {dailyGoals.currentStreak}-day streak
                </Text>
              </View>
            )}
            {dailyGoals.feedbacksGiven > 0 && (
              <View style={styles.goalChip}>
                <Ionicons name="chatbubble" size={14} color={Colors.primary} />
                <Text style={styles.goalChipText}>
                  {dailyGoals.feedbacksGiven}/{dailyGoals.feedbacksGoal} feedbacks today
                  {dailyGoals.feedbacksGiven >= dailyGoals.feedbacksGoal ? ' ✓' : ''}
                </Text>
              </View>
            )}
          </View>
        )}

        {/* Quick Actions */}
        <View style={styles.quickActions}>
          <TouchableOpacity
            style={styles.quickAction}
            activeOpacity={0.95}
            onPress={() => router.push('/(tabs)/history')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.primaryAlpha10 }]}>
              <Ionicons name="grid" size={20} color={Colors.primary} />
            </View>
            <Text style={styles.quickActionText}>View History</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.quickAction}
            activeOpacity={0.95}
            onPress={() => router.push('/(tabs)/history?filter=favorites')}
          >
            <View style={[styles.quickActionIcon, { backgroundColor: Colors.secondaryAlpha10 }]}>
              <Ionicons name="heart" size={20} color={Colors.secondary} />
            </View>
            <Text style={styles.quickActionText}>Favorites</Text>
          </TouchableOpacity>
        </View>

        {/* Recent Checks */}
        {outfits.length > 0 && (
          <View style={styles.section}>
            <View style={styles.sectionHeader}>
              <Text style={styles.sectionTitle}>Recent Checks</Text>
              <TouchableOpacity
                style={styles.seeAllButton}
                onPress={() => router.push('/(tabs)/history')}
              >
                <Text style={styles.seeAllText}>See all</Text>
                <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
              </TouchableOpacity>
            </View>
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={styles.recentScroll}
            >
              {outfits.map((outfit) => {
                // Format image URI properly - add base64 prefix if needed
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

        {/* Upgrade Card (only for free tier) */}
        {tier === 'free' && (
          <TouchableOpacity onPress={() => router.push('/upgrade' as any)}>
            <LinearGradient
              colors={[Colors.primary, Colors.secondary]}
              start={{ x: 0, y: 0 }}
              end={{ x: 1, y: 0 }}
              style={styles.upgradeCard}
            >
              <Text style={styles.upgradeTitle}>Upgrade to Plus</Text>
              <Text style={styles.upgradeDesc}>Unlimited checks, ad-free experience, and more</Text>
              <View style={styles.upgradeButton}>
                <Text style={styles.upgradeButtonText}>See Plans</Text>
              </View>
            </LinearGradient>
          </TouchableOpacity>
        )}

        {/* Ad banner for free users */}
        <AdBanner />

        {/* Invite Friends */}
        <TouchableOpacity style={styles.inviteCard} onPress={handleInvite} activeOpacity={0.85}>
          <View style={styles.inviteIcon}>
            <Ionicons name="person-add" size={22} color={Colors.sage} />
          </View>
          <View style={styles.inviteText}>
            <Text style={styles.inviteTitle}>Invite your friends</Text>
            <Text style={styles.inviteSubtitle}>Share Or This? and help them dress with confidence</Text>
          </View>
          <Ionicons name="share-outline" size={20} color={Colors.sage} />
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
    paddingBottom: Spacing.xl,
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  greeting: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  subtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  avatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  ctaCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: 'rgba(226, 232, 240, 0.5)',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.1,
    shadowRadius: 16,
    elevation: 8,
  },
  ctaIcon: {
    width: 64,
    height: 64,
    borderRadius: BorderRadius.lg,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  ctaText: {
    flex: 1,
  },
  ctaTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  ctaTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  ctaSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  dailyChecks: {
    alignItems: 'center',
    marginHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  dailyChecksText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  goalsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  goalChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingVertical: 4,
    paddingHorizontal: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  goalChipText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.text,
  },
  quickActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.md,
  },
  quickAction: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  quickActionIcon: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.md,
    justifyContent: 'center',
    alignItems: 'center',
  },
  quickActionText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.text,
  },
  section: {
    marginTop: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: Spacing.md,
    marginBottom: Spacing.sm,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
  },
  seeAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
  },
  seeAllText: {
    fontSize: FontSize.sm,
    fontWeight: '500',
    color: Colors.primary,
  },
  recentScroll: {
    paddingHorizontal: Spacing.md,
    gap: Spacing.sm,
  },
  recentCard: {
    width: 144,
  },
  upgradeCard: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.lg,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  upgradeTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.white,
  },
  upgradeDesc: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.8)',
    marginTop: Spacing.xs,
  },
  upgradeButton: {
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
    paddingVertical: 10,
    paddingHorizontal: 20,
    alignSelf: 'flex-start',
    marginTop: Spacing.md,
  },
  upgradeButtonText: {
    color: Colors.primary,
    fontWeight: '600',
    fontSize: FontSize.sm,
  },
  inviteCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    borderWidth: 1,
    borderColor: Colors.sageLight,
    gap: Spacing.md,
  },
  inviteIcon: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.sageAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  inviteText: {
    flex: 1,
  },
  inviteTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  inviteSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
