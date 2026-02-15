import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useLeaderboard } from '../src/hooks/useApi';

type LeaderboardType = 'top-rated' | 'most-helpful' | 'most-popular' | 'weekly';

type LeaderboardEntry = {
  id: string;
  username: string;
  rank: number;
  score: number;
  label: string;
};

export default function LeaderboardScreen() {
  const router = useRouter();
  const [type, setType] = useState<LeaderboardType>('top-rated');

  // Fetch real leaderboard data
  const { data, isLoading, error } = useLeaderboard(type, 50);

  const getScoreLabel = () => {
    switch (type) {
      case 'top-rated':
        return 'Avg Score';
      case 'most-helpful':
        return 'Feedback Given';
      case 'most-popular':
        return 'Total Votes';
      case 'weekly':
        return 'Weekly Score';
      default:
        return 'Score';
    }
  };

  const leaderboardData: LeaderboardEntry[] = data?.leaderboard?.map((item) => ({
    id: item.userId,
    username: item.username || 'user',
    rank: item.rank,
    score: item.score,
    label: getScoreLabel(),
  })) || [];

  const getTitle = () => {
    switch (type) {
      case 'top-rated':
        return 'Top Rated';
      case 'most-helpful':
        return 'Most Helpful';
      case 'most-popular':
        return 'Most Popular';
      case 'weekly':
        return 'This Week';
      default:
        return 'Leaderboard';
    }
  };

  const getDescription = () => {
    switch (type) {
      case 'top-rated':
        return 'Users with highest avg outfit scores (min 5 public outfits)';
      case 'most-helpful':
        return 'Users who give the most feedback to others';
      case 'most-popular':
        return 'Users with most total community votes received';
      case 'weekly':
        return 'Top performers this week (resets Monday)';
      default:
        return '';
    }
  };

  const renderFilterButton = (label: string, value: LeaderboardType) => (
    <TouchableOpacity
      style={[styles.filterButton, type === value && styles.filterButtonActive]}
      onPress={() => setType(value)}
      activeOpacity={0.7}
    >
      <Text style={[styles.filterText, type === value && styles.filterTextActive]}>
        {label}
      </Text>
    </TouchableOpacity>
  );

  const renderLeaderboardItem = ({ item }: { item: LeaderboardEntry }) => {
    const getRankColor = (rank: number) => {
      if (rank === 1) return Colors.warning;
      if (rank === 2) return Colors.textSecondary;
      if (rank === 3) return '#CD7F32'; // Bronze
      return Colors.textMuted;
    };

    const getRankIcon = (rank: number) => {
      if (rank === 1) return 'trophy';
      if (rank === 2) return 'medal';
      if (rank === 3) return 'medal-outline';
      return null;
    };

    const rankColor = getRankColor(item.rank);
    const rankIcon = getRankIcon(item.rank);

    return (
      <TouchableOpacity
        style={styles.leaderboardItem}
        onPress={() => router.push(`/user/${item.username}` as any)}
        activeOpacity={0.7}
      >
        <View style={styles.rankSection}>
          {rankIcon ? (
            <Ionicons name={rankIcon} size={24} color={rankColor} />
          ) : (
            <Text style={[styles.rankNumber, { color: rankColor }]}>#{item.rank}</Text>
          )}
        </View>

        <View style={styles.userSection}>
          <View style={styles.userAvatar}>
            <Text style={styles.userAvatarText}>{item.username.charAt(0).toUpperCase()}</Text>
          </View>
          <View style={styles.userInfo}>
            <Text style={styles.username}>@{item.username}</Text>
            <Text style={styles.scoreLabel}>{item.label}</Text>
          </View>
        </View>

        <View style={styles.scoreSection}>
          <Text style={styles.scoreValue}>{item.score.toFixed(1)}</Text>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Leaderboard</Text>
          <View style={{ width: 40 }} />
        </View>

        {/* Type Filters */}
        <View style={styles.filterContainer}>
          {renderFilterButton('Top Rated', 'top-rated')}
          {renderFilterButton('Helpful', 'most-helpful')}
        </View>
        <View style={styles.filterContainer}>
          {renderFilterButton('Popular', 'most-popular')}
          {renderFilterButton('This Week', 'weekly')}
        </View>

        {/* Description */}
        <View style={styles.descriptionSection}>
          <Text style={styles.descriptionText}>{getDescription()}</Text>
        </View>

        {/* Leaderboard List */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color={Colors.primary} />
          </View>
        ) : (
          <FlatList
            data={leaderboardData}
            renderItem={renderLeaderboardItem}
            keyExtractor={(item) => item.id}
            contentContainerStyle={styles.listContent}
            showsVerticalScrollIndicator={false}
            ListEmptyComponent={
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={64} color={Colors.textMuted} />
                <Text style={styles.emptyTitle}>No data yet</Text>
                <Text style={styles.emptyText}>
                  Start sharing outfits and giving feedback to appear on the leaderboard!
                </Text>
              </View>
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
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: 9999,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  filterContainer: {
    flexDirection: 'row',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.md,
    marginTop: Spacing.sm,
  },
  filterButton: {
    flex: 1,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surface,
    alignItems: 'center',
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
  descriptionSection: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
  },
  descriptionText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
  },
  listContent: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.xl,
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
  rankSection: {
    width: 48,
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  rankNumber: {
    fontSize: FontSize.lg,
    fontWeight: '700',
  },
  userSection: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
  },
  userAvatar: {
    width: 40,
    height: 40,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.sm,
  },
  userAvatarText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  userInfo: {
    flex: 1,
  },
  username: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  scoreLabel: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
  scoreSection: {
    marginLeft: Spacing.md,
  },
  scoreValue: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.primary,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xxl * 2,
    paddingHorizontal: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    marginTop: Spacing.xs,
  },
});
