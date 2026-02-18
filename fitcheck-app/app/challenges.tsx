import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Image,
  FlatList,
  Modal,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import {
  useActiveChallenge,
  useChallenges,
  useChallengeLeaderboard,
  useMySubmission,
  useSubmitChallengeEntry,
  useVoteForSubmission,
  useOutfits,
} from '../src/hooks/useApi';
import type { OutfitCheck } from '../src/services/api.service';
import { track } from '../src/lib/analytics';

type Tab = 'current' | 'upcoming' | 'past';

const BANNER_GRADIENTS: [string, string][] = [
  ['#FF6B6B', '#FF8E53'],
  ['#4E65FF', '#8B5CF6'],
  ['#EC4899', '#F97316'],
  ['#10B981', '#3B82F6'],
];

function getGradient(index: number): [string, string] {
  return BANNER_GRADIENTS[index % BANNER_GRADIENTS.length];
}

function getTimeRemaining(endsAt: string) {
  const diff = new Date(endsAt).getTime() - Date.now();
  if (diff <= 0) return 'Ended';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  const hours = Math.floor((diff % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
  return `${days}d ${hours}h remaining`;
}

function getStartsIn(startsAt: string) {
  const diff = new Date(startsAt).getTime() - Date.now();
  if (diff <= 0) return 'Starting soon';
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));
  return `Starts in ${days} day${days !== 1 ? 's' : ''}`;
}

export default function ChallengesScreen() {
  useEffect(() => { track('feature_used', { feature: 'challenges' }); }, []);
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('current');
  const [showOutfitPicker, setShowOutfitPicker] = useState(false);

  // Data hooks
  const { data: activeData, isLoading: activeLoading } = useActiveChallenge();
  const { data: upcomingData, isLoading: upcomingLoading } = useChallenges('upcoming');
  const { data: pastData, isLoading: pastLoading } = useChallenges('ended');

  const activeChallenge = activeData?.challenge ?? null;

  const { data: leaderboardData, isLoading: leaderboardLoading } = useChallengeLeaderboard(
    activeChallenge?.id
  );
  const { data: mySubmissionData } = useMySubmission(activeChallenge?.id);

  const { data: outfitsData, isLoading: outfitsLoading } = useOutfits({ limit: 20 });
  const outfits: OutfitCheck[] = (outfitsData as any)?.outfits ?? [];

  const submitEntry = useSubmitChallengeEntry();
  const voteForSubmission = useVoteForSubmission();

  const mySubmission = mySubmissionData?.submission ?? null;
  const leaderboard = leaderboardData?.submissions ?? [];

  function handleSubmit(outfit: OutfitCheck) {
    if (!activeChallenge) return;
    setShowOutfitPicker(false);
    submitEntry.mutate(
      { challengeId: activeChallenge.id, outfitCheckId: outfit.id },
      {
        onSuccess: () => Alert.alert('Submitted!', 'Your outfit has been entered in the challenge.'),
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? 'Could not submit entry. Try again.';
          Alert.alert('Error', msg);
        },
      }
    );
  }

  function handleVote(submissionId: string) {
    if (!activeChallenge) return;
    voteForSubmission.mutate(
      { challengeId: activeChallenge.id, submissionId },
      {
        onError: (err: any) => {
          const msg = err?.response?.data?.error ?? 'Could not record vote. Try again.';
          Alert.alert('Error', msg);
        },
      }
    );
  }

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Style Challenges</Text>
        <View style={styles.backButton} />
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        {(['current', 'upcoming', 'past'] as Tab[]).map((tab) => (
          <TouchableOpacity
            key={tab}
            style={[styles.tab, activeTab === tab && styles.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[styles.tabText, activeTab === tab && styles.tabTextActive]}>
              {tab === 'current' ? 'Current' : tab === 'upcoming' ? 'Upcoming' : 'Past Winners'}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
        {/* ── CURRENT TAB ── */}
        {activeTab === 'current' && (
          <View style={styles.content}>
            {activeLoading ? (
              <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : !activeChallenge ? (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No active challenge right now</Text>
                <Text style={styles.emptySubtext}>Check back soon — new challenges start weekly!</Text>
              </View>
            ) : (
              <>
                {/* Challenge Banner */}
                <View style={styles.challengeBanner}>
                  <LinearGradient
                    colors={BANNER_GRADIENTS[0]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 1 }}
                    style={styles.bannerGradient}
                  >
                    <View style={styles.themeBadge}>
                      <Text style={styles.themeBadgeText}>{activeChallenge.theme}</Text>
                    </View>
                    <Text style={styles.challengeTitle}>{activeChallenge.title}</Text>
                    <Text style={styles.challengeDescription}>{activeChallenge.description}</Text>
                    <View style={styles.challengeStats}>
                      <View style={styles.statItem}>
                        <Ionicons name="time-outline" size={16} color={Colors.white} />
                        <Text style={styles.statText}>{getTimeRemaining(activeChallenge.endsAt)}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="people-outline" size={16} color={Colors.white} />
                        <Text style={styles.statText}>{activeChallenge.submissionCount} entries</Text>
                      </View>
                    </View>
                    {activeChallenge.prize && (
                      <View style={styles.prizeContainer}>
                        <Ionicons name="trophy" size={18} color={Colors.white} />
                        <Text style={styles.prizeText}>{activeChallenge.prize}</Text>
                      </View>
                    )}
                  </LinearGradient>
                </View>

                {/* Submit / Already submitted */}
                {mySubmission ? (
                  <View style={styles.alreadySubmitted}>
                    <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
                    <Text style={styles.alreadySubmittedText}>
                      You've entered with {mySubmission.votes} vote{mySubmission.votes !== 1 ? 's' : ''}
                    </Text>
                  </View>
                ) : (
                  <TouchableOpacity
                    style={styles.submitButton}
                    activeOpacity={0.8}
                    onPress={() => setShowOutfitPicker(true)}
                    disabled={submitEntry.isPending}
                  >
                    <LinearGradient
                      colors={[Colors.primary, Colors.secondary]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.submitButtonGradient}
                    >
                      {submitEntry.isPending ? (
                        <ActivityIndicator color={Colors.white} />
                      ) : (
                        <>
                          <Ionicons name="camera" size={20} color={Colors.white} />
                          <Text style={styles.submitButtonText}>Submit Your Outfit</Text>
                        </>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                )}

                {/* Leaderboard */}
                <View style={styles.section}>
                  <View style={styles.sectionHeader}>
                    <Text style={styles.sectionTitle}>Top Submissions</Text>
                  </View>

                  {leaderboardLoading ? (
                    <ActivityIndicator color={Colors.primary} />
                  ) : leaderboard.length === 0 ? (
                    <Text style={styles.emptySubtext}>No submissions yet — be the first!</Text>
                  ) : (
                    <View style={styles.leaderboard}>
                      {leaderboard.map((submission, index) => {
                        const rank = index + 1;
                        const isOwnSubmission = submission.id === mySubmission?.id;
                        return (
                          <View key={submission.id} style={styles.leaderboardItem}>
                            <View style={styles.rankBadge}>
                              {rank <= 3 ? (
                                <Ionicons
                                  name="medal"
                                  size={20}
                                  color={
                                    rank === 1 ? '#FFD700' : rank === 2 ? '#C0C0C0' : '#CD7F32'
                                  }
                                />
                              ) : (
                                <Text style={styles.rankText}>{rank}</Text>
                              )}
                            </View>
                            {submission.outfitCheck.thumbnailUrl ? (
                              <Image
                                source={{ uri: submission.outfitCheck.thumbnailUrl }}
                                style={styles.submissionThumbnail}
                              />
                            ) : (
                              <View style={[styles.submissionThumbnail, styles.thumbnailPlaceholder]}>
                                <Ionicons name="shirt-outline" size={20} color={Colors.textMuted} />
                              </View>
                            )}
                            <View style={styles.submissionInfo}>
                              <Text style={styles.submissionUsername}>
                                {submission.user.username
                                  ? `@${submission.user.username}`
                                  : submission.user.name ?? 'Anonymous'}
                              </Text>
                              <View style={styles.submissionStats}>
                                {submission.outfitCheck.aiScore != null && (
                                  <View style={styles.submissionStat}>
                                    <Ionicons name="star" size={14} color={Colors.warning} />
                                    <Text style={styles.submissionStatText}>
                                      {submission.outfitCheck.aiScore.toFixed(1)}
                                    </Text>
                                  </View>
                                )}
                                <View style={styles.submissionStat}>
                                  <Ionicons name="heart" size={14} color={Colors.secondary} />
                                  <Text style={styles.submissionStatText}>{submission.votes}</Text>
                                </View>
                              </View>
                            </View>
                            {!isOwnSubmission && (
                              <TouchableOpacity
                                style={styles.voteButton}
                                onPress={() => handleVote(submission.id)}
                                disabled={voteForSubmission.isPending}
                              >
                                <Ionicons name="heart-outline" size={20} color={Colors.primary} />
                              </TouchableOpacity>
                            )}
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* Rules */}
                <View style={styles.section}>
                  <Text style={styles.sectionTitle}>Challenge Rules</Text>
                  <View style={styles.rulesList}>
                    {[
                      'Submit only outfits that match the theme',
                      'One submission per user per challenge',
                      'Community votes + AI score determine winner',
                      'Follow community guidelines',
                    ].map((rule) => (
                      <View key={rule} style={styles.ruleItem}>
                        <Ionicons name="checkmark-circle" size={20} color={Colors.primary} />
                        <Text style={styles.ruleText}>{rule}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              </>
            )}
          </View>
        )}

        {/* ── UPCOMING TAB ── */}
        {activeTab === 'upcoming' && (
          <View style={styles.content}>
            {upcomingLoading ? (
              <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : !upcomingData?.challenges.length ? (
              <View style={styles.emptyState}>
                <Ionicons name="calendar-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No upcoming challenges</Text>
                <Text style={styles.emptySubtext}>Check back soon!</Text>
              </View>
            ) : (
              upcomingData.challenges.map((challenge, index) => (
                <View key={challenge.id} style={styles.upcomingCard}>
                  <LinearGradient
                    colors={getGradient(index + 1)}
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
              ))
            )}
          </View>
        )}

        {/* ── PAST WINNERS TAB ── */}
        {activeTab === 'past' && (
          <View style={styles.content}>
            {pastLoading ? (
              <ActivityIndicator style={styles.loader} color={Colors.primary} />
            ) : !pastData?.challenges.length ? (
              <View style={styles.emptyState}>
                <Ionicons name="trophy-outline" size={48} color={Colors.textMuted} />
                <Text style={styles.emptyText}>No completed challenges yet</Text>
              </View>
            ) : (
              pastData.challenges.map((challenge) => (
                <View key={challenge.id} style={styles.pastCard}>
                  <View style={styles.pastHeader}>
                    <Text style={styles.pastTitle}>{challenge.title}</Text>
                    <Ionicons name="trophy" size={20} color={Colors.warning} />
                  </View>
                  <Text style={styles.pastDescription}>{challenge.description}</Text>
                  <View style={styles.pastMeta}>
                    <Text style={styles.pastSubmissions}>{challenge.submissionCount} submissions</Text>
                    <Text style={styles.pastTheme}>{challenge.theme}</Text>
                  </View>
                </View>
              ))
            )}
          </View>
        )}

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Outfit Picker Modal */}
      <Modal
        visible={showOutfitPicker}
        animationType="slide"
        presentationStyle="pageSheet"
        onRequestClose={() => setShowOutfitPicker(false)}
      >
        <SafeAreaView style={styles.modalContainer}>
          <View style={styles.modalHeader}>
            <Text style={styles.modalTitle}>Choose an Outfit</Text>
            <TouchableOpacity onPress={() => setShowOutfitPicker(false)}>
              <Ionicons name="close" size={24} color={Colors.text} />
            </TouchableOpacity>
          </View>
          <Text style={styles.modalSubtitle}>Select one of your outfits to submit</Text>

          {outfitsLoading ? (
            <ActivityIndicator style={styles.loader} color={Colors.primary} />
          ) : outfits.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="shirt-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyText}>No outfits found</Text>
              <Text style={styles.emptySubtext}>Take a photo first, then come back to enter!</Text>
            </View>
          ) : (
            <FlatList
              data={outfits}
              keyExtractor={(item) => item.id}
              numColumns={2}
              contentContainerStyle={styles.outfitGrid}
              columnWrapperStyle={styles.outfitGridRow}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.outfitPickerItem}
                  activeOpacity={0.8}
                  onPress={() => handleSubmit(item)}
                >
                  {item.thumbnailUrl ? (
                    <Image source={{ uri: item.thumbnailUrl }} style={styles.outfitPickerImage} />
                  ) : (
                    <View style={[styles.outfitPickerImage, styles.thumbnailPlaceholder]}>
                      <Ionicons name="shirt-outline" size={32} color={Colors.textMuted} />
                    </View>
                  )}
                  {item.aiScore != null && (
                    <View style={styles.outfitScore}>
                      <Ionicons name="star" size={10} color={Colors.warning} />
                      <Text style={styles.outfitScoreText}>{item.aiScore.toFixed(1)}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              )}
            />
          )}
        </SafeAreaView>
      </Modal>
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
  loader: {
    marginTop: Spacing.xl,
  },
  emptyState: {
    alignItems: 'center',
    paddingVertical: Spacing.xl * 2,
    gap: Spacing.sm,
  },
  emptyText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.textSecondary,
  },
  emptySubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    paddingHorizontal: Spacing.lg,
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
  alreadySubmitted: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    marginBottom: Spacing.lg,
    justifyContent: 'center',
  },
  alreadySubmittedText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
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
  thumbnailPlaceholder: {
    justifyContent: 'center',
    alignItems: 'center',
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
  voteButton: {
    padding: Spacing.sm,
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
  pastMeta: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  pastSubmissions: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  pastTheme: {
    fontSize: FontSize.xs,
    fontWeight: '600',
    color: Colors.primary,
    backgroundColor: Colors.primaryLight + '20',
    paddingHorizontal: Spacing.sm,
    paddingVertical: 2,
    borderRadius: BorderRadius.full,
  },
  // Modal styles
  modalContainer: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  modalHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.md,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  modalTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
  },
  modalSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  outfitGrid: {
    padding: Spacing.md,
    gap: Spacing.sm,
  },
  outfitGridRow: {
    gap: Spacing.sm,
  },
  outfitPickerItem: {
    flex: 1,
    aspectRatio: 3 / 4,
    borderRadius: BorderRadius.md,
    overflow: 'hidden',
    backgroundColor: Colors.surfaceLight,
  },
  outfitPickerImage: {
    width: '100%',
    height: '100%',
  },
  outfitScore: {
    position: 'absolute',
    bottom: Spacing.xs,
    right: Spacing.xs,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
    borderRadius: BorderRadius.full,
    paddingHorizontal: 6,
    paddingVertical: 2,
  },
  outfitScoreText: {
    fontSize: 10,
    fontWeight: '700',
    color: Colors.white,
  },
});
