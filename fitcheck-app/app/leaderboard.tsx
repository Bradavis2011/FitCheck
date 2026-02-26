import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Image,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQuery } from '@tanstack/react-query';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { api } from '../src/services/api.service';

type LeaderboardType = 'weekly' | 'monthly' | 'alltime';

interface LeaderboardEntry {
  rank: number;
  userId: string;
  username: string;
  profileImageUrl?: string;
  points: number;
  level: number;
  badges: string[];
}

interface LeaderboardData {
  type: string;
  leaderboard: LeaderboardEntry[];
  userRank: number | null;
}

export default function LeaderboardScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<LeaderboardType>('weekly');

  const { data, isLoading, refetch, isRefetching } = useQuery<LeaderboardData>({
    queryKey: ['leaderboard', activeTab],
    queryFn: async () => {
      const response = await api.get(`/api/user/leaderboard/${activeTab}`);
      return response.data;
    },
  });

  const getMedalEmoji = (rank: number): string | null => {
    if (rank === 1) return '🥇';
    if (rank === 2) return '🥈';
    if (rank === 3) return '🥉';
    return null;
  };

  const getRankColor = (rank: number): string => {
    if (rank === 1) return '#FFD700'; // Gold
    if (rank === 2) return '#C0C0C0'; // Silver
    if (rank === 3) return '#CD7F32'; // Bronze
    return Colors.text;
  };

  const getTabTitle = (tab: LeaderboardType): string => {
    switch (tab) {
      case 'weekly':
        return 'This Week';
      case 'monthly':
        return 'This Month';
      case 'alltime':
        return 'All Time';
    }
  };

  const getResetInfo = (): string => {
    switch (activeTab) {
      case 'weekly':
        return 'Resets every Monday at midnight';
      case 'monthly':
        return 'Resets on the 1st of each month';
      case 'alltime':
        return 'Lifetime rankings';
    }
  };

  const renderTabButton = (tab: LeaderboardType, label: string) => (
    <TouchableOpacity
      style={[styles.tabButton, activeTab === tab && styles.tabButtonActive]}
      onPress={() => setActiveTab(tab)}
      activeOpacity={0.7}
    >
      <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderLeaderboardItem = ({ item }: { item: LeaderboardEntry }) => {
    const medal = getMedalEmoji(item.rank);
    const rankColor = getRankColor(item.rank);

    return (
      <TouchableOpacity
        style={[
          styles.leaderboardItem,
          item.rank <= 3 && styles.leaderboardItemTopThree,
        ]}
        activeOpacity={0.7}
      >
        {/* Rank */}
        <View style={styles.rankSection}>
          {medal ? (
            <Text style={styles.medalEmoji}>{medal}</Text>
          ) : (
            <Text style={[styles.rankNumber, { color: rankColor }]}>
              #{item.rank}
            </Text>
          )}
        </View>

        {/* User Info */}
        <View style={styles.userSection}>
          <View style={styles.avatarContainer}>
            {item.profileImageUrl ? (
              <Image
                source={{ uri: item.profileImageUrl }}
                style={styles.avatar}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <Text style={styles.avatarText}>
                  {item.username.charAt(0).toUpperCase()}
                </Text>
              </View>
            )}
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username} numberOfLines={1}>
              @{item.username}
            </Text>
            <View style={styles.userMeta}>
              <View style={styles.levelBadge}>
                <Text style={styles.levelText}>Lvl {item.level}</Text>
              </View>
              {item.badges.length > 0 && (
                <View style={styles.badgeCount}>
                  <Ionicons name="trophy" size={12} color={Colors.warning} />
                  <Text style={styles.badgeCountText}>{item.badges.length}</Text>
                </View>
              )}
            </View>
          </View>
        </View>

        {/* Points */}
        <View style={styles.pointsSection}>
          <Text style={[styles.pointsValue, item.rank <= 3 && styles.pointsValueTopThree]}>
            {item.points.toLocaleString()}
          </Text>
          <Text style={styles.pointsLabel}>pts</Text>
        </View>
      </TouchableOpacity>
    );
  };

  const renderUserRankBanner = () => {
    if (!data?.userRank) return null;

    return (
      <View style={styles.userRankBanner}>
        <Ionicons name="person" size={20} color={Colors.primary} />
        <Text style={styles.userRankText}>
          You're <Text style={styles.userRankBold}>#{data.userRank}</Text> {getTabTitle(activeTab).toLowerCase()}!
        </Text>
      </View>
    );
  };

  const renderEmptyState = () => (
    <View style={styles.emptyState}>
      <Ionicons name="trophy-outline" size={80} color={Colors.textMuted} />
      <Text style={styles.emptyTitle}>No Rankings Yet</Text>
      <Text style={styles.emptyText}>
        Start giving feedback to others to earn points and climb the leaderboard!
      </Text>
    </View>
  );

  const renderFooter = () => (
    <View style={styles.footer}>
      <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
      <Text style={styles.footerText}>{getResetInfo()}</Text>
    </View>
  );

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.backButton}
            onPress={() => router.back()}
            activeOpacity={0.7}
          >
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={styles.backButton} />
        </View>

        {/* Tabs */}
        <View style={styles.tabsContainer}>
          {renderTabButton('weekly', 'This Week')}
          {renderTabButton('monthly', 'This Month')}
          {renderTabButton('alltime', 'All Time')}
        </View>

        {/* User Rank Banner */}
        {renderUserRankBanner()}

        {/* Leaderboard List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
            <Text style={styles.loadingText}>Loading leaderboard...</Text>
          </View>
        ) : (
          <FlatList
            data={data?.leaderboard || []}
            renderItem={renderLeaderboardItem}
            keyExtractor={(item) => item.userId}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={renderEmptyState}
            ListFooterComponent={renderFooter}
            refreshControl={
              <RefreshControl
                refreshing={isRefetching}
                onRefresh={refetch}
                tintColor={Colors.primary}
                colors={[Colors.primary]}
              />
            }
          />
        )}
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  safeArea: {
    flex: 1,
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  headerTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  tabsContainer: {
    flexDirection: 'row',
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    gap: Spacing.sm,
  },
  tabButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
    justifyContent: 'center',
  },
  tabButtonActive: {
    backgroundColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  tabTextActive: {
    color: Colors.white,
  },
  userRankBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.md,
    marginTop: Spacing.md,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.lg,
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  userRankText: {
    fontSize: FontSize.md,
    color: Colors.text,
  },
  userRankBold: {
    fontWeight: '700',
    color: Colors.primary,
    fontSize: FontSize.lg,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingTop: Spacing.md,
    paddingBottom: Spacing.xxl,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  leaderboardItemTopThree: {
    borderWidth: 2,
  },
  rankSection: {
    width: 50,
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  medalEmoji: {
    fontSize: 32,
  },
  rankNumber: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  userSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  avatarContainer: {
    marginRight: Spacing.sm,
  },
  avatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
  },
  avatarPlaceholder: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
  },
  avatarText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  userMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  levelBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    backgroundColor: Colors.secondaryAlpha10,
    borderRadius: BorderRadius.sm,
  },
  levelText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.secondary,
  },
  badgeCount: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    paddingHorizontal: Spacing.xs,
    paddingVertical: 2,
    backgroundColor: Colors.warningAlpha10,
    borderRadius: BorderRadius.sm,
  },
  badgeCountText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.warning,
  },
  pointsSection: {
    alignItems: 'flex-end',
  },
  pointsValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.primary,
  },
  pointsValueTopThree: {
    fontSize: FontSize.xxl,
  },
  pointsLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: Spacing.xxl * 3,
    paddingHorizontal: Spacing.xl,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginTop: Spacing.lg,
    marginBottom: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 22,
  },
  footer: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.xs,
    paddingTop: Spacing.lg,
    paddingBottom: Spacing.md,
  },
  footerText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
});
