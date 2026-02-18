import { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  Animated,
  Image,
  ActivityIndicator,
  Share,
  BackHandler,
  Alert,
  Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as Haptics from 'expo-haptics';
import { InterstitialAd, AdEventType, TestIds } from 'react-native-google-mobile-ads';
import { useAppStore } from '../src/stores/auth';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import AdBanner from '../src/components/AdBanner';
import { recordOutfitCheck } from '../src/lib/adManager';
import ScoreDisplay from '../src/components/ScoreDisplay';
import FeedbackCard from '../src/components/FeedbackCard';
import FollowUpModal from '../src/components/FollowUpModal';
import StyleDNACard from '../src/components/StyleDNACard';
import { outfitService, type OutfitCheck } from '../src/services/api.service';
import { useTogglePublic, useCommunityFeedback, useOutfitExpertReview } from '../src/hooks/useApi';
import { useAuthStore } from '../src/stores/authStore';
import { track } from '../src/lib/analytics';

// TODO: Replace placeholder unit ID with real one from AdMob dashboard before release.
const INTERSTITIAL_UNIT_ID = __DEV__
  ? TestIds.INTERSTITIAL
  : Platform.select({
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      android: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      default: TestIds.INTERSTITIAL,
    })!;

export default function FeedbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const outfitId = params.outfitId as string;

  const { resetCheckFlow } = useAppStore();
  const { limits, tier } = useSubscriptionStore();
  const togglePublicMutation = useTogglePublic();

  const user = useAuthStore((s) => s.user);

  const [outfit, setOutfit] = useState<OutfitCheck | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [isPublic, setIsPublic] = useState(false);
  const [showHelpful, setShowHelpful] = useState(false);
  const [helpfulResponse, setHelpfulResponse] = useState<boolean | null>(null);
  const [showFollowUp, setShowFollowUp] = useState(false);
  const [isGeneratingShare, setIsGeneratingShare] = useState(false);
  const [showCommunityFeedback, setShowCommunityFeedback] = useState(false);
  const [isReanalyzing, setIsReanalyzing] = useState(false);

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const wasAnalyzingRef = useRef(false);
  const interstitialRef = useRef<InterstitialAd | null>(null);

  // Fetch community feedback if outfit is public
  const { data: communityFeedbackData } = useCommunityFeedback(isPublic ? outfitId : '');
  // Fetch expert review if outfit is loaded
  const { data: expertReviewData } = useOutfitExpertReview(outfitId);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleGoHome();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
  }, []);

  // Load interstitial ad for free-tier users
  useEffect(() => {
    if (!limits?.hasAds) return;
    try {
      const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });
      ad.load();
      interstitialRef.current = ad;
    } catch {
      // Native ads module not available in this environment (e.g. Expo Go)
    }
    return () => {
      interstitialRef.current = null;
    };
  }, []);

  // Poll for feedback
  useEffect(() => {
    if (!outfitId) {
      router.replace('/(tabs)' as any);
      return;
    }

    const fetchOutfit = async () => {
      try {
        const data = await outfitService.getOutfit(outfitId);
        setOutfit(data);
        setIsFavorite(data.isFavorite);
        setIsPublic(data.isPublic);

        // Stop polling if feedback is ready
        if (data.aiProcessedAt) {
          // Show interstitial for new analysis completions (free users, every 2nd check)
          if (wasAnalyzingRef.current && limits?.hasAds && recordOutfitCheck()) {
            setTimeout(() => {
              try {
                if (interstitialRef.current?.loaded) {
                  interstitialRef.current.show();
                }
              } catch {
                // Ignore if ad cannot be shown
              }
            }, 1500);
          }
          wasAnalyzingRef.current = false;
          if (data.aiScore != null) {
            track('outfit_check_completed', {
              score: data.aiScore,
              occasion: data.occasions?.[0],
            });
          }

          setIsLoading(false);
          if (pollInterval.current) {
            clearInterval(pollInterval.current);
            pollInterval.current = null;
          }

          // Show "Was this helpful?" after 3 seconds
          setTimeout(() => {
            setShowHelpful(true);
            Animated.timing(fadeAnim, {
              toValue: 1,
              duration: 300,
              useNativeDriver: true,
            }).start();
          }, 3000);
        } else {
          // outfit is still being analyzed
          wasAnalyzingRef.current = true;
        }
      } catch (error) {
        console.error('Failed to fetch outfit:', error);
        setIsLoading(false);
      }
    };

    // Initial fetch
    fetchOutfit();

    // Poll every 2 seconds until feedback is ready
    pollInterval.current = setInterval(fetchOutfit, 2000);

    return () => {
      if (pollInterval.current) {
        clearInterval(pollInterval.current);
      }
    };
  }, [outfitId]);

  const handleToggleFavorite = async () => {
    if (!outfit) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsFavorite(!isFavorite);
      await outfitService.toggleFavorite(outfit.id);
    } catch (error) {
      console.error('Failed to toggle favorite:', error);
      setIsFavorite(isFavorite); // Revert on error
    }
  };

  const handleHelpfulResponse = async (response: boolean) => {
    if (!outfit) return;

    try {
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setHelpfulResponse(response);
      await outfitService.rateFeedback(outfit.id, response);
    } catch (error) {
      console.error('Failed to submit feedback rating:', error);
    }
  };

  const handleTogglePublic = async () => {
    if (!outfit) return;

    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const newPublicState = !isPublic;
      setIsPublic(newPublicState);
      await togglePublicMutation.mutateAsync(outfit.id);

      if (newPublicState) {
        Alert.alert(
          '🎉 Shared to Community!',
          'Your outfit is now visible in the Community feed.',
          [{ text: 'View Community', onPress: () => router.push('/(tabs)/community' as any) }]
        );
      }
    } catch (error: any) {
      console.error('Failed to toggle public:', error);
      setIsPublic(isPublic); // Revert on error

      // Show error message if provided by backend
      if (error?.response?.data?.error) {
        Alert.alert('Cannot Share', error.response.data.error);
      } else {
        Alert.alert('Error', 'Failed to update sharing status. Please try again.');
      }
    }
  };

  const handleShareScore = async () => {
    if (!outfit) return;

    try {
      setIsGeneratingShare(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      track('share_tapped', { score: outfit.aiScore ?? 0, method: 'native_share' });

      const scoreEmoji = score >= 8 ? '🔥' : score >= 6 ? '✨' : '💭';
      const shareMessage = `Or This? Score: ${scoreEmoji} ${score}/10\n\n${feedback.summary}\n\nGet your outfit scored at OrThis.app!`;

      // For now, use text-only sharing
      // Image sharing requires rebuilding the app with EAS
      await Share.share({
        message: shareMessage,
        title: `My Or This? Score: ${score}/10`,
      });

      // TODO: Enable image sharing after EAS build
      // Uncomment this code after running: npx expo prebuild && npx expo run:ios/android
      /*
      if (viewShotRef.current) {
        await new Promise(resolve => setTimeout(resolve, 100));
        const uri = await viewShotRef.current.capture?.();

        if (uri && Platform.OS === 'ios') {
          await Share.share({ url: uri, message: shareMessage });
        } else if (uri) {
          // Android: Save to file system and share
          const fileUri = `${FileSystem.cacheDirectory}outfit-score.png`;
          await FileSystem.copyAsync({ from: uri, to: fileUri });
          await Share.share({ message: shareMessage });
        }
      }
      */
    } catch (error: any) {
      console.error('Failed to share score:', error);
      if (error.message !== 'User cancelled' && !error.message?.includes('cancelled')) {
        Alert.alert('Error', 'Failed to share. Please try again.');
      }
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleFollowUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    track('follow_up_asked', { outfit_id: outfitId, question_number: 1 });
    setShowFollowUp(true);
  };

  const handleCloseFollowUp = () => {
    setShowFollowUp(false);
  };

  const handleGoHome = () => {
    resetCheckFlow();
    router.push('/(tabs)' as any);
  };

  const handleNewCheck = () => {
    resetCheckFlow();
    router.replace('/(tabs)/camera' as any);
  };

  const handleReanalyze = async () => {
    if (!outfit || isReanalyzing) return;
    try {
      setIsReanalyzing(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      await outfitService.reanalyzeOutfit(outfit.id);
      // Reset local state so polling loop restarts
      setOutfit((prev) => prev ? { ...prev, aiFeedback: undefined, aiScore: undefined, aiProcessedAt: undefined } : prev);
      setIsLoading(true);
      // Re-start polling
      pollInterval.current = setInterval(async () => {
        try {
          const data = await outfitService.getOutfit(outfit.id);
          setOutfit(data);
          if (data.aiProcessedAt) {
            setIsLoading(false);
            setIsReanalyzing(false);
            if (pollInterval.current) clearInterval(pollInterval.current);
          }
        } catch (e) {
          console.error('Poll error during reanalyze:', e);
        }
      }, 2000);
    } catch (error) {
      console.error('Failed to reanalyze:', error);
      Alert.alert('Error', 'Failed to start re-analysis. Please try again.');
      setIsReanalyzing(false);
    }
  };

  const getScoreColor = (value: number) => {
    if (value >= 8) return Colors.success;
    if (value >= 6) return Colors.warning;
    return Colors.error;
  };

  if (isLoading || !outfit?.aiFeedback) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Analyzing your outfit...</Text>
        <Text style={styles.loadingSubtext}>This usually takes 10-15 seconds</Text>
      </View>
    );
  }

  const feedback = outfit.aiFeedback;
  const score = outfit.aiScore || 7;
  const imageUri = outfit.imageData ? `data:image/jpeg;base64,${outfit.imageData}` : outfit.imageUrl;
  const isFallbackResponse = feedback?.summary?.includes("trouble analyzing");

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoHome}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Feedback</Text>
          <TouchableOpacity style={styles.followUpHeaderButton} onPress={handleFollowUp}>
            <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Image and Score */}
          <View style={styles.topSection}>
            {imageUri && (
              <View style={styles.imageContainer}>
                <Image source={{ uri: imageUri }} style={styles.image} resizeMode="cover" />
              </View>
            )}
            <ScoreDisplay score={score} />
          </View>

          {/* Summary */}
          <View style={styles.summarySection}>
            <Text style={styles.summaryText}>{feedback.summary}</Text>
            {feedback.occasionMatch && (
              <View style={styles.matchBadge}>
                <Ionicons name="checkmark-circle" size={18} color={Colors.success} />
                <Text style={styles.matchText}>
                  {feedback.occasionMatch.notes || 'Perfect for this occasion'}
                </Text>
              </View>
            )}
          </View>

          {/* Retry Analysis Banner */}
          {isFallbackResponse && (
            <View style={styles.retryBanner}>
              <Ionicons name="alert-circle-outline" size={20} color={Colors.warning} />
              <Text style={styles.retryBannerText}>Analysis didn't complete fully</Text>
              <TouchableOpacity
                style={styles.retryButton}
                onPress={handleReanalyze}
                disabled={isReanalyzing}
              >
                {isReanalyzing ? (
                  <ActivityIndicator size="small" color={Colors.white} />
                ) : (
                  <Text style={styles.retryButtonText}>Retry</Text>
                )}
              </TouchableOpacity>
            </View>
          )}

          {/* What's Working */}
          {feedback.whatsWorking && feedback.whatsWorking.length > 0 && (
            <FeedbackCard
              title="What's Working"
              icon="✅"
              iconColor={Colors.success}
              delay={0}
            >
              {feedback.whatsWorking.map((item, index) => (
                <View key={index} style={styles.feedbackItem}>
                  <Text style={styles.feedbackItemTitle}>{item.point}</Text>
                  <Text style={styles.feedbackItemDetail}>{item.detail}</Text>
                </View>
              ))}
            </FeedbackCard>
          )}

          {/* Consider */}
          {feedback.consider && feedback.consider.length > 0 && (
            <FeedbackCard
              title="Consider"
              icon="💭"
              iconColor={Colors.warning}
              delay={200}
            >
              {feedback.consider.map((item, index) => (
                <View key={index} style={styles.feedbackItem}>
                  <Text style={styles.feedbackItemTitle}>{item.point}</Text>
                  <Text style={styles.feedbackItemDetail}>{item.detail}</Text>
                </View>
              ))}
            </FeedbackCard>
          )}

          {/* Quick Fixes */}
          {feedback.quickFixes && feedback.quickFixes.length > 0 && (
            <FeedbackCard
              title="Quick Fixes"
              icon="💡"
              iconColor={Colors.info}
              delay={400}
            >
              {feedback.quickFixes.map((fix, index) => (
                <View key={index} style={styles.feedbackItem}>
                  <Text style={styles.feedbackItemTitle}>{fix.suggestion}</Text>
                  <Text style={styles.feedbackItemDetail}>{fix.impact}</Text>
                </View>
              ))}
            </FeedbackCard>
          )}

          {/* Style DNA */}
          {feedback.styleDNA && (
            <StyleDNACard styleDNA={feedback.styleDNA} delay={600} />
          )}

          {/* Follow-up Questions */}
          <View style={styles.followUpSection}>
            <TouchableOpacity style={styles.followUpButton} onPress={handleFollowUp}>
              <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
              <Text style={styles.followUpButtonText}>Ask a Follow-up Question</Text>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Helpful prompt */}
          {showHelpful && helpfulResponse === null && (
            <Animated.View style={[styles.helpfulSection, { opacity: fadeAnim }]}>
              <Text style={styles.helpfulText}>Was this helpful?</Text>
              <View style={styles.helpfulButtons}>
                <TouchableOpacity
                  style={[styles.helpfulButton, styles.helpfulButtonPositive]}
                  onPress={() => handleHelpfulResponse(true)}
                >
                  <Ionicons name="thumbs-up-outline" size={24} color={Colors.success} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.helpfulButton, styles.helpfulButtonNegative]}
                  onPress={() => handleHelpfulResponse(false)}
                >
                  <Ionicons name="thumbs-down-outline" size={24} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {helpfulResponse !== null && (
            <View style={styles.thankYouSection}>
              <Ionicons name="checkmark-circle" size={24} color={Colors.success} />
              <Text style={styles.thankYouText}>Thanks for your feedback!</Text>
            </View>
          )}

          {/* Community Feedback Section */}
          {isPublic && communityFeedbackData?.feedback && communityFeedbackData.feedback.length > 0 && (
            <View style={styles.communityFeedbackSection}>
              <View style={styles.communityFeedbackHeader}>
                <Text style={styles.communityFeedbackTitle}>Community Feedback</Text>
                <View style={styles.communityScoreBadge}>
                  <Ionicons name="people" size={16} color={Colors.primary} />
                  <Text style={styles.communityScoreText}>
                    {(outfit.communityAvgScore || 0).toFixed(1)}/10
                  </Text>
                  <Text style={styles.communityCountText}>
                    ({communityFeedbackData.feedback.length})
                  </Text>
                </View>
              </View>

              {showCommunityFeedback ? (
                <>
                  {communityFeedbackData.feedback.map((feedback) => (
                    <View key={feedback.id} style={styles.communityFeedbackItem}>
                      <View style={styles.communityFeedbackItemHeader}>
                        <View style={styles.communityFeedbackUser}>
                          {feedback.user.profileImageUrl ? (
                            <Image
                              source={{ uri: feedback.user.profileImageUrl }}
                              style={styles.communityFeedbackUserAvatar}
                            />
                          ) : (
                            <View style={[styles.communityFeedbackUserAvatar, styles.communityFeedbackUserAvatarPlaceholder]}>
                              <Text style={styles.communityFeedbackUserAvatarText}>
                                {(feedback.user.username || feedback.user.name || 'A')[0].toUpperCase()}
                              </Text>
                            </View>
                          )}
                          <Text style={styles.communityFeedbackUsername}>
                            {feedback.user.username || feedback.user.name || 'Anonymous'}
                          </Text>
                        </View>
                        <View style={styles.communityFeedbackScore}>
                          <Text style={[styles.communityFeedbackScoreText, { color: getScoreColor(feedback.score) }]}>
                            {feedback.score}/10
                          </Text>
                        </View>
                      </View>
                      <Text style={styles.communityFeedbackComment}>{feedback.comment}</Text>
                      <Text style={styles.communityFeedbackTime}>
                        {new Date(feedback.createdAt).toLocaleDateString()}
                      </Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.showLessButton}
                    onPress={() => setShowCommunityFeedback(false)}
                  >
                    <Text style={styles.showLessButtonText}>Show Less</Text>
                    <Ionicons name="chevron-up" size={16} color={Colors.primary} />
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowCommunityFeedback(true)}
                >
                  <Text style={styles.showMoreButtonText}>
                    View {communityFeedbackData.feedback.length} feedback{communityFeedbackData.feedback.length !== 1 ? 's' : ''}
                  </Text>
                  <Ionicons name="chevron-down" size={16} color={Colors.primary} />
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Expert Review Section */}
          {expertReviewData?.review ? (
            // Completed review
            <View style={styles.expertReviewSection}>
              <View style={styles.expertReviewHeader}>
                <Ionicons name="ribbon" size={20} color={Colors.primary} />
                <Text style={styles.expertReviewTitle}>Expert Review</Text>
                <View style={styles.expertScoreBadge}>
                  <Text style={[styles.expertScoreText, { color: expertReviewData.review.score !== null && expertReviewData.review.score >= 8 ? Colors.success : expertReviewData.review.score !== null && expertReviewData.review.score >= 6 ? Colors.warning : Colors.error }]}>
                    {expertReviewData.review.score}/10
                  </Text>
                </View>
              </View>
              <Text style={styles.expertReviewerName}>
                by @{expertReviewData.review.stylist.user.username || expertReviewData.review.stylist.user.name || 'Stylist'}
                {' '}· {expertReviewData.review.stylist.rating.toFixed(1)} ⭐
              </Text>
              <Text style={styles.expertReviewText}>{expertReviewData.review.feedback}</Text>
            </View>
          ) : tier === 'pro' ? (
            // Pro user — show request button
            <TouchableOpacity
              style={styles.expertReviewCTA}
              onPress={() =>
                router.push({
                  pathname: '/request-expert-review' as any,
                  params: {
                    outfitId: outfit.id,
                    thumbnailUrl: outfit.thumbnailUrl || '',
                  },
                })
              }
              activeOpacity={0.8}
            >
              <Ionicons name="ribbon-outline" size={20} color={Colors.primary} />
              <View style={{ flex: 1 }}>
                <Text style={styles.expertReviewCTATitle}>Get an Expert Review</Text>
                <Text style={styles.expertReviewCTASubtitle}>
                  A verified stylist will give you professional feedback
                </Text>
              </View>
              <Ionicons name="chevron-forward" size={18} color={Colors.textMuted} />
            </TouchableOpacity>
          ) : null}

          {/* Share to Community */}
          {score >= 7 ? (
            // High score: Prominent CTA
            <View style={styles.shareProminentContainer}>
              <LinearGradient
                colors={[Colors.primary, Colors.secondary]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.shareProminentCard}
              >
                <View style={styles.shareProminentContent}>
                  <Text style={styles.shareProminentTitle}>🔥 Great score!</Text>
                  <Text style={styles.shareProminentDesc}>
                    Share with the community for feedback
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.shareToggleButton, isPublic && styles.shareToggleButtonActive]}
                  onPress={handleTogglePublic}
                  activeOpacity={0.8}
                >
                  <Ionicons
                    name={isPublic ? 'checkmark-circle' : 'people-outline'}
                    size={20}
                    color={isPublic ? Colors.white : Colors.primary}
                  />
                  <Text style={[styles.shareToggleText, isPublic && styles.shareToggleTextActive]}>
                    {isPublic ? 'Shared' : 'Share'}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          ) : (
            // Lower score: Secondary option
            <View style={styles.shareSecondaryContainer}>
              <View style={styles.shareSecondaryRow}>
                <View style={{ flex: 1 }}>
                  <Text style={styles.shareSecondaryTitle}>Community Feed</Text>
                  <Text style={styles.shareSecondaryDesc}>
                    Get feedback from others
                  </Text>
                </View>
                <TouchableOpacity
                  style={[styles.shareSecondaryToggle, isPublic && styles.shareSecondaryToggleActive]}
                  onPress={handleTogglePublic}
                  activeOpacity={0.8}
                >
                  <View style={[styles.shareSecondaryThumb, isPublic && styles.shareSecondaryThumbActive]} />
                </TouchableOpacity>
              </View>
            </View>
          )}

          {/* Ad banner for free users */}
          <AdBanner />

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity
            style={[styles.favoriteButton, isFavorite && styles.favoriteButtonActive]}
            onPress={handleToggleFavorite}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? Colors.white : Colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButtonLarge}
            onPress={handleShareScore}
            disabled={isGeneratingShare}
          >
            {isGeneratingShare ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="share-social" size={20} color={Colors.white} />
                <Text style={styles.shareButtonText}>Share Score</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.newCheckButton} onPress={handleNewCheck}>
            <Ionicons name="camera" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Follow-up modal */}
      <FollowUpModal
        visible={showFollowUp}
        onClose={handleCloseFollowUp}
        feedbackSummary={feedback.summary}
        outfitId={outfit.id}
        maxFollowUps={limits?.followUpsPerCheck ?? 3}
        feedback={feedback}
        occasions={outfit.occasions}
        specificConcerns={outfit.specificConcerns}
        existingFollowUps={outfit.followUps}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  loadingContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: Colors.background,
    gap: Spacing.md,
  },
  loadingText: {
    fontSize: FontSize.lg,
    fontWeight: '600',
    color: Colors.text,
    marginTop: Spacing.md,
  },
  loadingSubtext: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
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
  followUpHeaderButton: {
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
  topSection: {
    alignItems: 'center',
    paddingTop: Spacing.lg,
  },
  imageContainer: {
    width: 160,
    height: 200,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
    marginBottom: Spacing.lg,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  summarySection: {
    padding: Spacing.lg,
    gap: Spacing.md,
  },
  summaryText: {
    fontSize: FontSize.lg,
    lineHeight: 26,
    color: Colors.text,
    fontWeight: '500',
    textAlign: 'center',
  },
  matchBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    alignSelf: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderRadius: BorderRadius.full,
  },
  matchText: {
    fontSize: FontSize.sm,
    color: Colors.success,
    fontWeight: '600',
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
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    gap: Spacing.sm,
  },
  retryBannerText: {
    flex: 1,
    fontSize: FontSize.sm,
    color: Colors.warning,
    fontWeight: '500',
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.warning,
    borderRadius: BorderRadius.full,
    minWidth: 56,
    alignItems: 'center',
  },
  retryButtonText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  followUpSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.md,
  },
  followUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  followUpButtonText: {
    flex: 1,
    marginLeft: Spacing.sm,
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  helpfulSection: {
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginVertical: Spacing.md,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    gap: Spacing.sm,
  },
  helpfulText: {
    fontSize: FontSize.md,
    color: Colors.text,
    fontWeight: '600',
    textAlign: 'center',
  },
  helpfulButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  helpfulButton: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    justifyContent: 'center',
    alignItems: 'center',
  },
  helpfulButtonPositive: {
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
  },
  helpfulButtonNegative: {
    backgroundColor: Colors.surface,
  },
  thankYouSection: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginVertical: Spacing.md,
  },
  thankYouText: {
    fontSize: FontSize.md,
    color: Colors.success,
    fontWeight: '600',
  },
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  favoriteButton: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  favoriteButtonActive: {
    backgroundColor: Colors.secondary,
    borderColor: Colors.secondary,
  },
  shareButtonLarge: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 4,
    elevation: 4,
  },
  shareButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  newCheckButton: {
    width: 48,
    height: 48,
    borderRadius: 9999,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: Colors.border,
  },
  // Share to Community - Prominent (high scores)
  shareProminentContainer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
  },
  shareProminentCard: {
    borderRadius: BorderRadius.lg,
    padding: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareProminentContent: {
    flex: 1,
    marginRight: Spacing.md,
  },
  shareProminentTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.white,
    marginBottom: 4,
  },
  shareProminentDesc: {
    fontSize: FontSize.sm,
    color: 'rgba(255,255,255,0.9)',
  },
  shareToggleButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    backgroundColor: Colors.white,
    borderRadius: BorderRadius.full,
  },
  shareToggleButtonActive: {
    backgroundColor: 'rgba(255,255,255,0.3)',
  },
  shareToggleText: {
    fontSize: FontSize.sm,
    fontWeight: '600',
    color: Colors.primary,
  },
  shareToggleTextActive: {
    color: Colors.white,
  },
  // Share to Community - Secondary (lower scores)
  shareSecondaryContainer: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
  },
  shareSecondaryRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  shareSecondaryTitle: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  shareSecondaryDesc: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginTop: 2,
  },
  shareSecondaryToggle: {
    width: 48,
    height: 28,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  shareSecondaryToggleActive: {
    backgroundColor: Colors.primary,
  },
  shareSecondaryThumb: {
    width: 20,
    height: 20,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
  },
  shareSecondaryThumbActive: {
    alignSelf: 'flex-end',
  },
  // Community Feedback Section
  communityFeedbackSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  communityFeedbackHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: Spacing.md,
  },
  communityFeedbackTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  communityScoreBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.full,
  },
  communityScoreText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.primary,
  },
  communityCountText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  communityFeedbackItem: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
  },
  communityFeedbackItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: Spacing.sm,
  },
  communityFeedbackUser: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  communityFeedbackUserAvatar: {
    width: 32,
    height: 32,
    borderRadius: BorderRadius.full,
  },
  communityFeedbackUserAvatarPlaceholder: {
    backgroundColor: Colors.primary,
    justifyContent: 'center',
    alignItems: 'center',
  },
  communityFeedbackUserAvatarText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.white,
  },
  communityFeedbackUsername: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.text,
  },
  communityFeedbackScore: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
  },
  communityFeedbackScoreText: {
    fontSize: FontSize.sm,
    fontWeight: '700',
  },
  communityFeedbackComment: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 20,
    marginBottom: Spacing.xs,
  },
  communityFeedbackTime: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
  },
  showMoreButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
  },
  showMoreButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  showLessButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  showLessButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  // Expert Review Section
  expertReviewSection: {
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.lg,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '30',
  },
  expertReviewHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginBottom: 4,
  },
  expertReviewTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    flex: 1,
  },
  expertScoreBadge: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
  },
  expertScoreText: {
    fontSize: FontSize.md,
    fontWeight: '700',
  },
  expertReviewerName: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
  },
  expertReviewText: {
    fontSize: FontSize.md,
    color: Colors.text,
    lineHeight: 22,
  },
  expertReviewCTA: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    marginHorizontal: Spacing.lg,
    marginTop: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    borderWidth: 1,
    borderColor: Colors.primary + '40',
  },
  expertReviewCTATitle: {
    fontSize: FontSize.sm,
    fontWeight: '700',
    color: Colors.text,
  },
  expertReviewCTASubtitle: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    marginTop: 2,
  },
});
