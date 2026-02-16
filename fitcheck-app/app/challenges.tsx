import { useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Image, FlatList } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';

// Mock data - will be replaced with API
const ACTIVE_CHALLENGE = {
  id: '1',
  title: 'Best Fall Layers',
  description: 'Show us your best layered looks for autumn weather',
  theme: 'Seasonal',
  endsAt: '2026-02-20T23:59:59Z',
  submissions: 247,
  prize: '500 points + Featured Profile',
  bannerGradient: ['#FF6B6B', '#FF8E53'],
};

const UPCOMING_CHALLENGES = [
  {
    id: '2',
    title: 'Power Suit Monday',
    description: 'Professional looks that mean business',
    theme: 'Workwear',
    startsAt: '2026-02-23T00:00:00Z',
    bannerGradient: ['#4E65FF', '#8B5CF6'],
  },
  {
    id: '3',
    title: 'Date Night Glam',
    description: 'Your most romantic evening looks',
    theme: 'Occasion',
    startsAt: '2026-02-27T00:00:00Z',
    bannerGradient: ['#EC4899', '#F97316'],
  },
];

const PAST_CHALLENGES = [
  {
    id: '4',
    title: 'Winter Whites',
    description: 'Monochromatic winter elegance',
    winner: '@fashionista_jane',
    winnerScore: 9.2,
    submissions: 312,
  },
  {
    id: '5',
    title: 'Streetwear Supreme',
    description: 'Urban style at its finest',
    winner: '@style_king',
    winnerScore: 8.9,
    submissions: 289,
  },
];

const TOP_SUBMISSIONS = [
  {
    id: 's1',
    username: '@fashionista_jane',
    imageUrl: 'https://via.placeholder.com/400x600',
    score: 9.2,
    votes: 156,
    rank: 1,
  },
  {
    id: 's2',
    username: '@style_maven',
    imageUrl: 'https://via.placeholder.com/400x600',
    score: 8.8,
    votes: 142,
    rank: 2,
  },
  {
    id: 's3',
    username: '@outfit_guru',
    imageUrl: 'https://via.placeholder.com/400x600',
    score: 8.5,
    votes: 128,
    rank: 3,
  },
];

export default function ChallengesScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'current' | 'upcoming' | 'past'>('current');

  const getTimeRemaining = (endsAt: string) => {
    const now = new Date();
    const end = new Date(endsAt);
    const diff = end.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    return `${days}d ${hours}h remaining`;
  };

  const getStartsIn = (startsAt: string) => {
    const now = new Date();
    const start = new Date(startsAt);
    const diff = start.getTime() - now.getTime();
    const days = Math.floor(diff / (1000 * 60 * 60 * 24));
    return `Starts in ${days} days`;
  };

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Style Challenges</Text>
        <TouchableOpacity style={styles.infoButton} onPress={() => {}}>
          <Ionicons name="information-circle-outline" size={24} color={Colors.text} />
        </TouchableOpacity>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'current' && styles.tabActive]}
          onPress={() => setActiveTab('current')}
        >
          <Text style={[styles.tabText, activeTab === 'current' && styles.tabTextActive]}>
            Current
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'upcoming' && styles.tabActive]}
          onPress={() => setActiveTab('upcoming')}
        >
          <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>
            Upcoming
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'past' && styles.tabActive]}
          onPress={() => setActiveTab('past')}
        >
          <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>
            Past Winners
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* Current Challenge */}
        {activeTab === 'current' && (
          <View style={styles.content}>
            {/* Challenge Banner */}
            <TouchableOpacity
              style={styles.challengeBanner}
              activeOpacity={0.9}
              onPress={() => {}}
            >
              <LinearGradient
                colors={ACTIVE_CHALLENGE.bannerGradient}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.bannerGradient}
              >
                <View style={styles.themeBadge}>
                  <Text style={styles.themeBadgeText}>{ACTIVE_CHALLENGE.theme}</Text>
                </View>
                <Text style={styles.challengeTitle}>{ACTIVE_CHALLENGE.title}</Text>
                <Text style={styles.challengeDescription}>
                  {ACTIVE_CHALLENGE.description}
                </Text>
                <View style={styles.challengeStats}>
                  <View style={styles.statItem}>
                    <Ionicons name="time-outline" size={16} color={Colors.white} />
                    <Text style={styles.statText}>
                      {getTimeRemaining(ACTIVE_CHALLENGE.endsAt)}
                    </Text>
                  </View>
                  <View style={styles.statItem}>
                    <Ionicons name="people-outline" size={16} color={Colors.white} />
                    <Text style={styles.statText}>{ACTIVE_CHALLENGE.submissions} entries</Text>
                  </View>
                </View>
                <View style={styles.prizeContainer}>
                  <Ionicons name="trophy" size={18} color={Colors.white} />
                  <Text style={styles.prizeText}>{ACTIVE_CHALLENGE.prize}</Text>
                </View>
              </LinearGradient>
            </TouchableOpacity>

            {/* Submit Button */}
            <TouchableOpacity style={styles.submitButton} activeOpacity={0.8} onPress={() => {}}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.submitButtonGradient}
              >
                <Ionicons name="camera" size={20} color={Colors.white} />
                <Text style={styles.submitButtonText}>Submit Your Outfit</Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Leaderboard */}
            <View style={styles.section}>
              <View style={styles.sectionHeader}>
                <Text style={styles.sectionTitle}>Top Submissions</Text>
                <TouchableOpacity onPress={() => {}}>
                  <Text style={styles.viewAllText}>View All</Text>
                </TouchableOpacity>
              </View>

              <View style={styles.leaderboard}>
                {TOP_SUBMISSIONS.map((submission) => (
                  <TouchableOpacity
                    key={submission.id}
                    style={styles.leaderboardItem}
                    activeOpacity={0.8}
                    onPress={() => {}}
                  >
                    <View style={styles.rankBadge}>
                      {submission.rank <= 3 ? (
                        <Ionicons
                          name="medal"
                          size={20}
                          color={
                            submission.rank === 1
                              ? '#FFD700'
                              : submission.rank === 2
                              ? '#C0C0C0'
                              : '#CD7F32'
                          }
                        />
                      ) : (
                        <Text style={styles.rankText}>{submission.rank}</Text>
                      )}
                    </View>
                    <Image
                      source={{ uri: submission.imageUrl }}
                      style={styles.submissionThumbnail}
                    />
                    <View style={styles.submissionInfo}>
                      <Text style={styles.submissionUsername}>{submission.username}</Text>
                      <View style={styles.submissionStats}>
                        <View style={styles.submissionStat}>
                          <Ionicons name="star" size={14} color={Colors.warning} />
                          <Text style={styles.submissionStatText}>{submission.score}</Text>
                        </View>
                        <View style={styles.submissionStat}>
                          <Ionicons name="heart" size={14} color={Colors.secondary} />
                          <Text style={styles.submissionStatText}>{submission.votes}</Text>
                        </View>
                      </View>
                    </View>
                    <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            {/* Rules */}
            <View style={styles.section}>
              <Text style={styles.sectionTitle}>Challenge Rules</Text>
              <View style={styles.rulesList}>
                <View style={styles.ruleItem}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  <Text style={styles.ruleText}>Submit only outfits that match the theme</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  <Text style={styles.ruleText}>One submission per user per challenge</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  <Text style={styles.ruleText}>Community votes + AI score determine winner</Text>
                </View>
                <View style={styles.ruleItem}>
                  <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                  <Text style={styles.ruleText}>Follow community guidelines</Text>
                </View>
              </View>
            </View>
          </View>
        )}

        {/* Upcoming Challenges */}
        {activeTab === 'upcoming' && (
          <View style={styles.content}>
            {UPCOMING_CHALLENGES.map((challenge) => (
              <View key={challenge.id} style={styles.upcomingCard}>
                <LinearGradient
                  colors={challenge.bannerGradient}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.upcomingGradient}
                >
                  <View style={styles.themeBadge}>
                    <Text style={styles.themeBadgeText}>{challenge.theme}</Text>
                  </View>
                  <Text style={styles.upcomingTitle}>{challenge.title}</Text>
                  <Text style={styles.upcomingDescription}>{challenge.description}</Text>
                  <Text style={styles.upcomingTime}>{getStartsIn(challenge.startsAt)}</Text>
                </LinearGradient>
              </View>
            ))}
          </View>
        )}

        {/* Past Winners */}
        {activeTab === 'past' && (
          <View style={styles.content}>
            {PAST_CHALLENGES.map((challenge) => (
              <TouchableOpacity
                key={challenge.id}
                style={styles.pastCard}
                activeOpacity={0.8}
                onPress={() => {}}
              >
                <View style={styles.pastHeader}>
                  <Text style={styles.pastTitle}>{challenge.title}</Text>
                  <Ionicons name="trophy" size={20} color={Colors.warning} />
                </View>
                <Text style={styles.pastDescription}>{challenge.description}</Text>
                <View style={styles.pastWinner}>
                  <Text style={styles.pastWinnerLabel}>Winner:</Text>
                  <Text style={styles.pastWinnerName}>{challenge.winner}</Text>
                  <View style={styles.pastWinnerScore}>
                    <Ionicons name="star" size={14} color={Colors.warning} />
                    <Text style={styles.pastWinnerScoreText}>{challenge.winnerScore}</Text>
                  </View>
                </View>
                <Text style={styles.pastSubmissions}>{challenge.submissions} submissions</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>
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
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  backButton: {
    width: 40,
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
  },
  infoButton: {
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
  tabs: {
    flexDirection: 'row',
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  tab: {
    flex: 1,
    paddingVertical: Spacing.md,
    alignItems: 'center',
  },
  tabActive: {
    borderBottomWidth: 2,
    borderBottomColor: Colors.primary,
  },
  tabText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.textMuted,
  },
  tabTextActive: {
    color: Colors.primary,
  },
  scrollView: {
    flex: 1,
  },
  content: {
    padding: Spacing.md,
  },
  challengeBanner: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  bannerGradient: {
    padding: Spacing.lg,
  },
  themeBadge: {
    alignSelf: 'flex-start',
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    marginBottom: Spacing.sm,
  },
  themeBadgeText: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.white,
  },
  challengeTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  challengeDescription: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  challengeStats: {
    flexDirection: 'row',
    gap: Spacing.md,
    marginBottom: Spacing.sm,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
  },
  statText: {
    fontSize: FontSize.sm,
    color: Colors.white,
    fontWeight: '500',
  },
  prizeContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    backgroundColor: 'rgba(255,255,255,0.2)',
    borderRadius: BorderRadius.md,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    alignSelf: 'flex-start',
  },
  prizeText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  submitButton: {
    borderRadius: BorderRadius.full,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  submitButtonGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.lg,
  },
  submitButtonText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
  },
  section: {
    marginBottom: Spacing.lg,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  viewAllText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  leaderboard: {
    gap: Spacing.sm,
  },
  leaderboardItem: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    gap: Spacing.md,
  },
  rankBadge: {
    width: 32,
    height: 32,
    justifyContent: 'center',
    alignItems: 'center',
  },
  rankText: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.textMuted,
  },
  submissionThumbnail: {
    width: 56,
    height: 74,
    borderRadius: BorderRadius.sm,
    backgroundColor: Colors.surfaceLight,
  },
  submissionInfo: {
    flex: 1,
  },
  submissionUsername: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 4,
  },
  submissionStats: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  submissionStat: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  submissionStatText: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
  },
  rulesList: {
    gap: Spacing.sm,
  },
  ruleItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: Spacing.sm,
  },
  ruleText: {
    flex: 1,
    fontSize: FontSize.md,
    color: Colors.textSecondary,
    lineHeight: 22,
  },
  upcomingCard: {
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.md,
  },
  upcomingGradient: {
    padding: Spacing.lg,
  },
  upcomingTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: Spacing.xs,
  },
  upcomingDescription: {
    fontSize: FontSize.md,
    color: 'rgba(255,255,255,0.9)',
    lineHeight: 22,
    marginBottom: Spacing.md,
  },
  upcomingTime: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.white,
  },
  pastCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    marginBottom: Spacing.md,
  },
  pastHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.xs,
  },
  pastTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  pastDescription: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
  },
  pastWinner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  pastWinnerLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  pastWinnerName: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  pastWinnerScore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginLeft: 'auto',
  },
  pastWinnerScoreText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.text,
  },
  pastSubmissions: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
});
