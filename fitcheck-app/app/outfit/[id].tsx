import { useState, useEffect } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  Image,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Share,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, BorderRadius, getScoreColor } from '../../src/constants/theme';
import ScoreDisplay from '../../src/components/ScoreDisplay';
import FeedbackCard from '../../src/components/FeedbackCard';
import CommunityFeedbackCard from '../../src/components/CommunityFeedbackCard';
import FeedbackScoreSlider from '../../src/components/FeedbackScoreSlider';
import ReportModal from '../../src/components/ReportModal';
import { socialService } from '../../src/services/api.service';
import { useCommunityFeedback, useSubmitCommunityFeedback, useReferralStats } from '../../src/hooks/useApi';
import { useAuthStore } from '../../src/stores/authStore';

const QUICK_SUGGESTIONS = ['Great fit!', 'Love the colors', 'Try different shoes', 'Perfect for the occasion'];

export default function PublicOutfitScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const outfitId = params.id as string;
  const user = useAuthStore((s) => s.user);

  const [outfit, setOutfit] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [showFeedbackForm, setShowFeedbackForm] = useState(false);
  const [feedbackScore, setFeedbackScore] = useState(7);
  const [feedbackComment, setFeedbackComment] = useState('');
  const [showReportModal, setShowReportModal] = useState(false);

  const { data: communityFeedbackData, refetch: refetchFeedback } = useCommunityFeedback(outfitId);
  const submitFeedbackMutation = useSubmitCommunityFeedback();
  const { data: referralStats } = useReferralStats();

  const communityFeedback = communityFeedbackData?.feedback || [];
  const userExistingFeedback = communityFeedback.find((f: any) => f.userId === user?.id);
  const userHasFeedback = !!userExistingFeedback;
  const isOwnOutfit = outfit?.userId === user?.id;

  // Calculate aggregate community score
  const avgCommunityScore =
    communityFeedback.length > 0
      ? communityFeedback.reduce((sum, f) => sum + f.score, 0) / communityFeedback.length
      : null;

  useEffect(() => {
    loadOutfit();
  }, [outfitId]);

  // Pre-fill form when user's existing feedback loads
  useEffect(() => {
    if (userExistingFeedback) {
      setFeedbackScore((userExistingFeedback as any).score);
      setFeedbackComment((userExistingFeedback as any).comment || '');
      setShowFeedbackForm(true);
    }
  }, [(userExistingFeedback as any)?.score, (userExistingFeedback as any)?.comment]);

  const loadOutfit = async () => {
    try {
      setIsLoading(true);
      const data = await socialService.getPublicOutfit(outfitId);
      setOutfit(data);
    } catch (error) {
      console.error('Failed to load outfit:', error);
      Alert.alert('Error', 'Failed to load outfit details');
    } finally {
      setIsLoading(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (feedbackComment.length > 500) {
      Alert.alert('Comment Too Long', 'Comments must be 500 characters or less');
      return;
    }

    const isUpdate = userHasFeedback;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      await submitFeedbackMutation.mutateAsync({
        outfitId,
        score: feedbackScore,
        comment: feedbackComment,
      });

      refetchFeedback();
      Alert.alert('Success', isUpdate ? 'Your rating has been updated!' : 'Your feedback has been submitted!');

      if (!isUpdate) {
        setShowFeedbackForm(false);
        setFeedbackComment('');
        setFeedbackScore(7);
      }
    } catch (error: any) {
      console.error('Failed to submit feedback:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.error || 'Failed to submit feedback. Please try again.'
      );
    }
  };

  const handleReport = async (reason: string, details: string) => {
    await socialService.reportContent('outfit', outfitId, reason as any, details);
  };

  const handleShare = async () => {
    try {
      const score = outfit.aiScore || 0;
      const username = outfit.user?.username || 'someone';
      const scoreEmoji = score >= 8 ? '🔥' : score >= 6 ? '✨' : '💭';
      const inviteLink = referralStats?.link ?? 'https://orthis.app';
      await Share.share({
        message: `Check out ${username}'s outfit on Or This? ${scoreEmoji} ${score}/10\n\nGet your own outfit scored: ${inviteLink}`,
        title: `Or This? — ${score}/10`,
      });
    } catch (error: any) {
      if (!error.message?.includes('cancelled')) {
        Alert.alert('Error', 'Failed to share. Please try again.');
      }
    }
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (!outfit) {
    return (
      <View style={styles.loadingContainer}>
        <Text style={styles.errorText}>Outfit not found</Text>
      </View>
    );
  }

  const imageUri = outfit.imageUrl || outfit.imageData;
  const score = outfit.aiScore || 7;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Outfit Details</Text>
          <View style={styles.headerActions}>
            <TouchableOpacity style={styles.backButton} onPress={handleShare}>
              <Ionicons name="share-social-outline" size={22} color={Colors.text} />
            </TouchableOpacity>
            {!isOwnOutfit && (
              <TouchableOpacity
                style={styles.backButton}
                onPress={() => setShowReportModal(true)}
              >
                <Ionicons name="ellipsis-horizontal" size={24} color={Colors.text} />
              </TouchableOpacity>
            )}
          </View>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* User Info */}
          <TouchableOpacity
            style={styles.userSection}
            onPress={() => {
              if (outfit.user?.username) {
                router.push(`/user/${outfit.user.username}` as any);
              }
            }}
            activeOpacity={0.7}
          >
            <View style={styles.userAvatar}>
              <Text style={styles.userAvatarText}>
                {outfit.user?.username?.charAt(0).toUpperCase() || 'A'}
              </Text>
            </View>
            <View style={styles.userInfo}>
              <Text style={styles.username}>@{outfit.user?.username || 'anonymous'}</Text>
              <Text style={styles.timestamp}>
                {new Date(outfit.createdAt).toLocaleDateString()}
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={20} color={Colors.textMuted} />
          </TouchableOpacity>

          {/* Image and AI Score */}
          <View style={styles.imageSection}>
            {imageUri ? (
              <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
            ) : (
              <View style={[styles.image, styles.placeholderImage]}>
                <Ionicons name="shirt-outline" size={64} color={Colors.textMuted} />
              </View>
            )}
            <ScoreDisplay score={score} />
          </View>

          {/* AI Feedback */}
          {outfit.aiFeedback && (
            <>
              <View style={styles.summarySection}>
                <Text style={styles.sectionTitle}>AI Feedback</Text>
                <Text style={styles.summaryText}>{outfit.aiFeedback.summary}</Text>
              </View>

              {outfit.aiFeedback.whatsWorking?.length > 0 && (
                <FeedbackCard
                  title="What's Working"
                  icon="✅"
                  iconColor={Colors.success}
                  delay={0}
                >
                  {outfit.aiFeedback.whatsWorking.map((item: any, index: number) => (
                    <View key={index} style={styles.feedbackItem}>
                      <Text style={styles.feedbackItemTitle}>{item.point}</Text>
                      <Text style={styles.feedbackItemDetail}>{item.detail}</Text>
                    </View>
                  ))}
                </FeedbackCard>
              )}

              {outfit.aiFeedback.consider?.length > 0 && (
                <FeedbackCard title="Consider" icon="💭" iconColor={Colors.warning} delay={200}>
                  {outfit.aiFeedback.consider.map((item: any, index: number) => (
                    <View key={index} style={styles.feedbackItem}>
                      <Text style={styles.feedbackItemTitle}>{item.point}</Text>
                      <Text style={styles.feedbackItemDetail}>{item.detail}</Text>
                    </View>
                  ))}
                </FeedbackCard>
              )}
            </>
          )}

          {/* Community Score Aggregate */}
          {avgCommunityScore !== null && (
            <View style={styles.aggregateSection}>
              <Text style={styles.sectionTitle}>Community Feedback</Text>
              <View style={styles.aggregateRow}>
                <Text style={styles.aggregateScore}>{avgCommunityScore.toFixed(1)}/10</Text>
                <Text style={styles.aggregateText}>
                  based on {communityFeedback.length}{' '}
                  {communityFeedback.length === 1 ? 'vote' : 'votes'}
                </Text>
              </View>
            </View>
          )}

          {/* Feedback Form */}
          {!isOwnOutfit && (
            <View style={styles.feedbackFormSection}>
              {!showFeedbackForm ? (
                <TouchableOpacity
                  style={styles.feedbackFormButton}
                  onPress={() => setShowFeedbackForm(true)}
                  activeOpacity={0.7}
                >
                  <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
                  <Text style={styles.feedbackFormButtonText}>Add Your Feedback</Text>
                </TouchableOpacity>
              ) : (
                <View style={styles.feedbackForm}>
                  <Text style={styles.feedbackFormTitle}>
                    {userHasFeedback ? 'Update your rating' : 'What do you think?'}
                  </Text>

                  <FeedbackScoreSlider value={feedbackScore} onChange={setFeedbackScore} />

                  <View style={styles.suggestionPills}>
                    {QUICK_SUGGESTIONS.map((s) => (
                      <TouchableOpacity
                        key={s}
                        style={[
                          styles.suggestionPill,
                          feedbackComment === s && styles.suggestionPillActive,
                        ]}
                        onPress={() => setFeedbackComment(feedbackComment === s ? '' : s)}
                        activeOpacity={0.7}
                      >
                        <Text style={[
                          styles.suggestionPillText,
                          feedbackComment === s && styles.suggestionPillTextActive,
                        ]}>{s}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>

                  <TextInput
                    style={styles.feedbackInput}
                    value={feedbackComment}
                    onChangeText={setFeedbackComment}
                    placeholder="Add a comment... (optional)"
                    placeholderTextColor={Colors.textMuted}
                    multiline
                    maxLength={500}
                    numberOfLines={4}
                  />
                  <Text style={styles.characterCount}>{feedbackComment.length}/500</Text>

                  <View style={styles.feedbackActions}>
                    <TouchableOpacity
                      style={styles.feedbackCancelButton}
                      onPress={() => {
                        setShowFeedbackForm(false);
                        setFeedbackComment('');
                      }}
                    >
                      <Text style={styles.feedbackCancelText}>Cancel</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={styles.feedbackSubmitButton}
                      onPress={handleSubmitFeedback}
                      disabled={submitFeedbackMutation.isPending}
                    >
                      {submitFeedbackMutation.isPending ? (
                        <ActivityIndicator size="small" color={Colors.white} />
                      ) : (
                        <Text style={styles.feedbackSubmitText}>Submit</Text>
                      )}
                    </TouchableOpacity>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Own Outfit Notice */}
          {isOwnOutfit && (
            <View style={styles.ownOutfitNotice}>
              <Ionicons name="information-circle" size={20} color={Colors.info} />
              <Text style={styles.ownOutfitText}>This is your outfit</Text>
            </View>
          )}

          {/* Community Feedback List */}
          {communityFeedback.length > 0 && (
            <View style={styles.feedbackListSection}>
              <Text style={styles.sectionTitle}>
                Community Votes ({communityFeedback.length})
              </Text>
              {communityFeedback.map((feedback) => (
                <CommunityFeedbackCard key={feedback.id} feedback={feedback} />
              ))}
            </View>
          )}

          <View style={{ height: 60 }} />
        </ScrollView>
      </SafeAreaView>

      {/* Report Modal */}
      <ReportModal
        visible={showReportModal}
        onClose={() => setShowReportModal(false)}
        targetType="outfit"
        targetId={outfitId}
        targetName={outfit?.user?.username || 'unknown'}
        onSubmit={handleReport}
      />
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
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
  },
  errorText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
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
  headerActions: {
    flexDirection: 'row',
    gap: 8,
    alignItems: 'center',
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
  scrollView: {
    flex: 1,
  },
  userSection: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
  },
  userAvatar: {
    width: 48,
    height: 48,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primaryAlpha10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: Spacing.md,
  },
  userAvatarText: {
    fontSize: FontSize.lg,
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
  timestamp: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  imageSection: {
    alignItems: 'center',
    paddingVertical: Spacing.lg,
  },
  image: {
    width: 240,
    height: 300,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.lg,
  },
  placeholderImage: {
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  summarySection: {
    padding: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  summaryText: {
    fontSize: FontSize.md,
    lineHeight: 22,
    color: Colors.text,
  },
  feedbackItem: {
    gap: 4,
  },
  feedbackItemTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  feedbackItemDetail: {
    fontSize: FontSize.sm,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  aggregateSection: {
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  aggregateRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: Spacing.sm,
  },
  aggregateScore: {
    fontSize: FontSize.xxl * 1.5,
    fontWeight: '700',
    color: Colors.primary,
  },
  aggregateText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
  },
  feedbackFormSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  feedbackFormButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  feedbackFormButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  feedbackForm: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
  },
  feedbackFormTitle: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: Spacing.md,
  },
  feedbackInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    borderWidth: 1,
    borderColor: Colors.border,
    marginTop: Spacing.md,
    height: 100,
    textAlignVertical: 'top',
  },
  characterCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  feedbackActions: {
    flexDirection: 'row',
    gap: Spacing.sm,
    marginTop: Spacing.md,
  },
  feedbackCancelButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
    alignItems: 'center',
  },
  feedbackCancelText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  feedbackSubmitButton: {
    flex: 1,
    padding: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
  },
  feedbackSubmitText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
  },
  ownOutfitNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.infoAlpha10,
    borderRadius: BorderRadius.lg,
    marginBottom: Spacing.md,
  },
  ownOutfitText: {
    fontSize: FontSize.sm,
    color: Colors.info,
  },
  suggestionPills: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
    marginTop: Spacing.md,
    marginBottom: Spacing.xs,
  },
  suggestionPill: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 6,
    borderRadius: 0,
    borderWidth: 1,
    borderColor: Colors.border,
    backgroundColor: Colors.background,
  },
  suggestionPillActive: {
    borderColor: Colors.primary,
    backgroundColor: Colors.primaryAlpha10,
  },
  suggestionPillText: {
    fontSize: FontSize.xs,
    color: Colors.text,
  },
  suggestionPillTextActive: {
    color: Colors.primary,
  },
  feedbackListSection: {
    padding: Spacing.lg,
  },
});
