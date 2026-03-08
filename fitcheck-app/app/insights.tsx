import { useState } from 'react';
import { View, Text, StyleSheet, FlatList, TouchableOpacity, RefreshControl, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, Fonts, BorderRadius } from '../src/constants/theme';
import { useInsights, InsightItem } from '../src/hooks/useApi';
import InsightCard from '../src/components/InsightCard';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';

export default function InsightsScreen() {
  const router = useRouter();
  const { tier } = useSubscriptionStore();
  const isPlus = tier === 'plus' || tier === 'pro';
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const { data, isLoading, refetch, isFetching } = useInsights(isPlus ? 50 : 2);

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const visibleInsights = (data?.insights || []).filter(i => !dismissedIds.has(i.id));

  const renderItem = ({ item }: { item: InsightItem }) => (
    <View style={styles.itemWrapper}>
      <InsightCard insight={item} onDismiss={handleDismiss} />
    </View>
  );

  const renderEmpty = () => {
    if (isLoading) return null;
    return (
      <View style={styles.emptyState}>
        <Ionicons name="sparkles-outline" size={40} color={Colors.textMuted} />
        <Text style={styles.emptyTitle}>Your AI is learning</Text>
        <Text style={styles.emptyBody}>Insights will appear as you use the app. Check more outfits to unlock your stylist's observations.</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} activeOpacity={0.7} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={22} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.screenTitle}>Your Stylist</Text>
        <View style={{ width: 22 }} />
      </View>

      {/* Rule */}
      <View style={styles.headerRule} />

      {/* Activity summary */}
      {data?.agentActivity && (data.agentActivity.outfitsAnalyzedOvernight > 0 || data.agentActivity.improvementsMade > 0) && (
        <View style={styles.activityRow}>
          <View style={styles.dot} />
          <Text style={styles.activityText}>
            {[
              data.agentActivity.outfitsAnalyzedOvernight > 0 ? `${data.agentActivity.outfitsAnalyzedOvernight} outfits analyzed` : null,
              data.agentActivity.improvementsMade > 0 ? `${data.agentActivity.improvementsMade} improvements this week` : null,
            ].filter(Boolean).join(' · ')}
          </Text>
        </View>
      )}

      {!isPlus ? (
        // Free: show real milestone/AI improvement cards + upgrade banner after
        isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={visibleInsights}
            keyExtractor={item => item.id}
            renderItem={renderItem}
            contentContainerStyle={styles.list}
            showsVerticalScrollIndicator={false}
            ListHeaderComponent={visibleInsights.length > 0 ? undefined : (
              <View style={styles.emptyState}>
                <Ionicons name="sparkles-outline" size={40} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>Your AI is learning</Text>
                <Text style={styles.emptyBody}>Check more outfits and your AI will start surfacing observations here.</Text>
              </View>
            )}
            ListFooterComponent={
              <View style={styles.upgradeBanner}>
                <Ionicons name="sparkles" size={20} color={Colors.primary} />
                <View style={{ flex: 1, gap: 4 }}>
                  <Text style={styles.upgradeBannerTitle}>More is waiting</Text>
                  <Text style={styles.upgradeBannerBody}>Event follow-ups, weekly style narratives, and wardrobe picks — unlocked with Plus.</Text>
                </View>
                <TouchableOpacity style={styles.upgradeBannerBtn} onPress={() => router.push('/upgrade' as any)} activeOpacity={0.85}>
                  <Text style={styles.upgradeBannerBtnText}>Upgrade</Text>
                </TouchableOpacity>
              </View>
            }
            refreshControl={
              <RefreshControl
                refreshing={isFetching && !isLoading}
                onRefresh={refetch}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
          />
        )
      ) : isLoading ? (
        <View style={styles.loadingContainer}>
          <ActivityIndicator color={Colors.primary} />
        </View>
      ) : (
        <FlatList
          data={visibleInsights}
          keyExtractor={item => item.id}
          renderItem={renderItem}
          ListEmptyComponent={renderEmpty}
          contentContainerStyle={styles.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl
              refreshing={isFetching && !isLoading}
              onRefresh={refetch}
              tintColor={Colors.primary}
              colors={[Colors.primary]}
            />
          }
        />
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
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backBtn: {
    padding: 4,
  },
  screenTitle: {
    fontFamily: Fonts.serif,
    fontSize: 24,
    color: Colors.text,
  },
  headerRule: {
    height: 1,
    backgroundColor: Colors.borderSolid,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
  },
  activityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: Colors.primaryAlpha10,
    paddingVertical: 10,
    paddingHorizontal: Spacing.md,
    marginHorizontal: Spacing.md,
    marginBottom: Spacing.md,
    borderRadius: BorderRadius.sharp,
  },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  activityText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.xs,
    color: Colors.primary,
    flex: 1,
  },
  list: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xxl,
    gap: Spacing.sm,
  },
  itemWrapper: {
    marginBottom: Spacing.sm,
  },
  emptyState: {
    alignItems: 'center',
    paddingTop: 80,
    paddingHorizontal: Spacing.xl,
    gap: Spacing.md,
  },
  emptyTitle: {
    fontFamily: Fonts.serif,
    fontSize: FontSize.lg,
    color: Colors.text,
    textAlign: 'center',
  },
  emptyBody: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  paywall: {
    flex: 1,
    alignItems: 'center',
    paddingHorizontal: Spacing.xl,
    paddingTop: 60,
    gap: Spacing.md,
  },
  paywallTitle: {
    fontFamily: Fonts.serif,
    fontSize: 28,
    color: Colors.text,
    textAlign: 'center',
  },
  paywallBody: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  paywallFeatures: {
    alignSelf: 'stretch',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  paywallFeatureRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  paywallDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: Colors.primary,
  },
  paywallFeatureText: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  paywallBtn: {
    alignSelf: 'stretch',
    backgroundColor: Colors.primary,
    paddingVertical: 16,
    alignItems: 'center',
    marginTop: Spacing.md,
    borderRadius: BorderRadius.sharp,
  },
  paywallBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 13,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  upgradeBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.primaryAlpha10,
    borderWidth: 1,
    borderColor: Colors.primary,
    borderRadius: BorderRadius.sharp,
  },
  upgradeBannerTitle: {
    fontFamily: Fonts.sansMedium,
    fontSize: FontSize.sm,
    color: Colors.text,
  },
  upgradeBannerBody: {
    fontFamily: Fonts.sans,
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    lineHeight: 16,
  },
  upgradeBannerBtn: {
    backgroundColor: Colors.primary,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: BorderRadius.sharp,
  },
  upgradeBannerBtnText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
});
