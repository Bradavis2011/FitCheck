import { useState, useEffect, useRef, useCallback } from 'react';
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
  Dimensions,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams, useFocusEffect } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
// react-native-view-shot requires native binary — guard so Expo Go loads safely
let ViewShot: any = null;
try { ViewShot = require('react-native-view-shot').default; } catch { /* unavailable in Expo Go */ }
import * as FileSystem from 'expo-file-system/legacy';
// expo-sharing requires native module — guard so Expo Go loads safely
let Sharing: any = null;
try { Sharing = require('expo-sharing'); } catch { /* unavailable in Expo Go */ }
import { useAppStore } from '../src/stores/auth';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { Colors, Spacing, Fonts, getScoreColor } from '../src/constants/theme';
import AdBanner from '../src/components/AdBanner';
import { recordOutfitCheck } from '../src/lib/adManager';
import FeedbackCard from '../src/components/FeedbackCard';
import FollowUpModal from '../src/components/FollowUpModal';
import StyleDNACard from '../src/components/StyleDNACard';
import ShareableScoreCard from '../src/components/ShareableScoreCard';
import { outfitService, type OutfitCheck } from '../src/services/api.service';
import { useTogglePublic, useCommunityFeedback, useReferralStats } from '../src/hooks/useApi';
import { useAuthStore } from '../src/stores/authStore';
import { track } from '../src/lib/analytics';
import { normalizeFeedback, type NormalizedFeedback } from '../src/utils/feedbackAdapter';

let _ads: any = null;
try { _ads = require('react-native-google-mobile-ads'); } catch { /* native module unavailable */ }
const InterstitialAd = _ads?.InterstitialAd;
const _TestIds = _ads?.TestIds;

const INTERSTITIAL_UNIT_ID = __DEV__
  ? (_TestIds?.INTERSTITIAL ?? '')
  : Platform.select({
      ios: 'ca-app-pub-XXXXXXXXXXXXXXXX/XXXXXXXXXX',
      android: 'ca-app-pub-1244039707249288/3950498348',
      default: _TestIds?.INTERSTITIAL ?? '',
    })!;

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const HERO_HEIGHT = Math.round(SCREEN_WIDTH * 1.1); // ~portrait aspect

export default function FeedbackScreen() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const params = useLocalSearchParams();
  const outfitId = params.outfitId as string;

  const { resetCheckFlow } = useAppStore();
  const { limits, tier } = useSubscriptionStore();
  const togglePublicMutation = useTogglePublic();
  const user = useAuthStore((s) => s.user);
  const { data: referralStats } = useReferralStats();

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
  const hasLoadedRef = useRef(false);
  const interstitialRef = useRef<any>(null);
  const viewShotRef = useRef<any>(null);

  const { data: communityFeedbackData } = useCommunityFeedback(isPublic ? outfitId : '');

  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleGoHome();
      return true;
    });
    return () => backHandler.remove();
  }, []);

  useEffect(() => {
    if (!limits?.hasAds || !InterstitialAd) return;
    try {
      const ad = InterstitialAd.createForAdRequest(INTERSTITIAL_UNIT_ID, {
        requestNonPersonalizedAdsOnly: true,
      });
      ad.load();
      interstitialRef.current = ad;
    } catch { /* Native ads unavailable */ }
    return () => { interstitialRef.current = null; };
  }, []);

  useFocusEffect(
    useCallback(() => {
      if (!outfitId) {
        router.replace('/(tabs)' as any);
        return;
      }

      // Don't restart polling if already loaded (screen refocused after back navigation)
      if (hasLoadedRef.current) return;

      const fetchOutfit = async () => {
        try {
          const data = await outfitService.getOutfit(outfitId);
          setOutfit(data);
          setIsFavorite(data.isFavorite);
          setIsPublic(data.isPublic);

          if (data.aiProcessedAt) {
            hasLoadedRef.current = true;
            if (wasAnalyzingRef.current && limits?.hasAds && recordOutfitCheck()) {
              setTimeout(() => {
                try {
                  if (interstitialRef.current?.loaded) interstitialRef.current.show();
                } catch { /* ignore */ }
              }, 1500);
            }
            wasAnalyzingRef.current = false;
            if (data.aiScore != null) {
              track('outfit_check_completed', { score: data.aiScore, occasion: data.occasions?.[0] });
            }
            setIsLoading(false);
            if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = null; }
            setTimeout(() => {
              setShowHelpful(true);
              Animated.timing(fadeAnim, { toValue: 1, duration: 300, useNativeDriver: true }).start();
            }, 3000);
          } else {
            wasAnalyzingRef.current = true;
          }
        } catch (error) {
          console.error('Failed to fetch outfit:', error);
          setIsLoading(false);
        }
      };

      fetchOutfit();
      pollInterval.current = setInterval(fetchOutfit, 2000);

      return () => {
        if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = null; }
      };
    }, [outfitId])
  );

  const handleToggleFavorite = async () => {
    if (!outfit) return;
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      setIsFavorite(!isFavorite);
      await outfitService.toggleFavorite(outfit.id);
    } catch {
      setIsFavorite(isFavorite);
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
        Alert.alert('Shared to Community', 'Your outfit is now visible in the Community feed.', [
          { text: 'OK' },
        ]);
      }
    } catch (error: any) {
      console.error('Failed to toggle public:', error);
      setIsPublic(isPublic);
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
      track('score_card_shared', { score: outfit.aiScore ?? 0, method: 'native_share' });

      const scoreEmoji = score >= 8 ? '🔥' : score >= 6 ? '✨' : '💭';
      const shareText = normalized?.editorialSummary || `I got a ${normalized?.overallScore}/10 on Or This?`;
      const callToAction = referralStats?.link
        ? `Try it yourself: ${referralStats.link}`
        : 'Get your outfit scored at OrThis.app!';
      const shareMessage = `Or This? Score: ${scoreEmoji} ${score}/10\n\n${shareText}\n\n${callToAction}`;

      let imageShared = false;
      if (viewShotRef.current?.capture) {
        try {
          await new Promise(resolve => setTimeout(resolve, 150));
          const uri = await viewShotRef.current.capture();
          if (uri) {
            const fileUri = `${FileSystem.cacheDirectory}outfit-score-${Date.now()}.png`;
            await FileSystem.copyAsync({ from: uri, to: fileUri });
            if (Platform.OS === 'ios') {
              // iOS Share.share supports url (local file) + message together — gives both image and text
              await Share.share({ message: shareMessage, url: fileUri });
              imageShared = true;
            } else {
              const canShare = Sharing && await Sharing.isAvailableAsync();
              if (canShare) {
                await Sharing.shareAsync(fileUri, { mimeType: 'image/png', dialogTitle: `My Or This? Score: ${score}/10` });
                imageShared = true;
              }
            }
          }
        } catch { /* fall through to text share */ }
      }

      if (!imageShared) {
        await Share.share({ message: shareMessage, title: `My Or This? Score: ${score}/10` });
      }
    } catch (error: any) {
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
      hasLoadedRef.current = false;
      setOutfit((prev) => prev ? { ...prev, aiFeedback: undefined, aiScore: undefined, aiProcessedAt: undefined } : prev);
      setIsLoading(true);
      pollInterval.current = setInterval(async () => {
        try {
          const data = await outfitService.getOutfit(outfit.id);
          setOutfit(data);
          if (data.aiProcessedAt) {
            hasLoadedRef.current = true;
            setIsLoading(false);
            setIsReanalyzing(false);
            if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = null; }
          }
        } catch (e) {
          console.error('Poll error during reanalyze:', e);
        }
      }, 2000);
    } catch (error) {
      Alert.alert('Error', 'Failed to start re-analysis. Please try again.');
      setIsReanalyzing(false);
    }
  };

  if (isLoading || !outfit?.aiFeedback) {
    return (
      <View style={styles.loadingContainer}>
        <TouchableOpacity
          style={styles.loadingBackButton}
          onPress={() => {
            if (pollInterval.current) { clearInterval(pollInterval.current); pollInterval.current = null; }
            router.back();
          }}
        >
          <Ionicons name="arrow-back" size={20} color={Colors.text} />
        </TouchableOpacity>
        <View style={styles.loadingDots}>
          <View style={[styles.loadingDot, { backgroundColor: Colors.primary }]} />
          <View style={[styles.loadingDot, { backgroundColor: Colors.primary, opacity: 0.5 }]} />
          <View style={[styles.loadingDot, { backgroundColor: Colors.primary, opacity: 0.2 }]} />
        </View>
        <Text style={styles.loadingText}>Reading your look...</Text>
        <Text style={styles.loadingSubtext}>This usually takes 10–15 seconds</Text>
      </View>
    );
  }

  const feedback = outfit.aiFeedback;
  const normalized = feedback ? normalizeFeedback(feedback) : null;
  const score = outfit.aiScore || 7;
  const imageUri = outfit.imageData ? `data:image/jpeg;base64,${outfit.imageData}` : outfit.imageUrl;
  const scoreColor = getScoreColor(score);
  const isFallbackResponse =
    normalized?.editorialSummary?.includes('trouble analyzing') ||
    (feedback as any)?.summary?.includes('trouble analyzing');

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Minimal header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoHome}>
            <Ionicons name="arrow-back" size={20} color={Colors.text} />
          </TouchableOpacity>
          <TouchableOpacity style={styles.followUpHeaderButton} onPress={handleFollowUp}>
            <Ionicons name="chatbubble-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Full-bleed hero image with score overlay */}
          {imageUri && (
            <View style={styles.heroContainer}>
              <Image
                source={{ uri: imageUri }}
                style={styles.heroImage}
                resizeMode="cover"
              />
              {/* Dark gradient overlay at bottom */}
              <View style={styles.heroOverlay} />
              {/* Score overlaid on image */}
              <View style={styles.scoreOverlay}>
                <Text style={[styles.scoreNumber, { color: scoreColor }]}>
                  {score.toFixed(1)}
                </Text>
                <Text style={styles.scoreOut}>/10</Text>
              </View>
            </View>
          )}

          {/* Retry Analysis Banner */}
          {isFallbackResponse && (
            <View style={styles.retryBanner}>
              <Ionicons name="alert-circle-outline" size={18} color={Colors.warning} />
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

          {/* What's Right */}
          {normalized && normalized.whatsRight.length > 0 && (
            <FeedbackCard title="What's Right" icon="" iconColor={Colors.success} delay={0}>
              {normalized.whatsRight.map((bullet, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletSymbol}>+</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </FeedbackCard>
          )}

          {/* Could Improve */}
          {normalized && normalized.couldImprove.length > 0 && (
            <FeedbackCard title="Could Improve" icon="" iconColor={Colors.warning} delay={200}>
              {normalized.couldImprove.map((bullet, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletSymbol}>–</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </FeedbackCard>
          )}

          {/* Take It Further */}
          {normalized && normalized.takeItFurther.length > 0 && (
            <FeedbackCard title="Take It Further" icon="" iconColor={Colors.primary} delay={400}>
              {normalized.takeItFurther.map((bullet, i) => (
                <View key={i} style={styles.bulletRow}>
                  <Text style={styles.bulletSymbol}>↑</Text>
                  <Text style={styles.bulletText}>{bullet}</Text>
                </View>
              ))}
            </FeedbackCard>
          )}

          {/* Editorial Summary — Vogue pull quote, shown last */}
          {normalized?.editorialSummary ? (
            <View style={styles.editorialCard}>
              <View style={styles.editorialRule} />
              <Text style={styles.editorialText}>{normalized.editorialSummary}</Text>
              <View style={styles.editorialRule} />
            </View>
          ) : null}

          {/* Style DNA */}
          {normalized?.styleDNA && (
            <StyleDNACard styleDNA={normalized.styleDNA} delay={600} />
          )}

          {/* Follow-up — sharp-corner input area */}
          <View style={styles.followUpSection}>
            <TouchableOpacity style={styles.followUpButton} onPress={handleFollowUp}>
              <Ionicons name="chatbubble-outline" size={18} color={Colors.primary} />
              <Text style={styles.followUpButtonText}>Ask a follow-up question</Text>
              <Ionicons name="chevron-forward" size={16} color={Colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Was this helpful? */}
          {showHelpful && helpfulResponse === null && (
            <Animated.View style={[styles.helpfulSection, { opacity: fadeAnim }]}>
              <Text style={styles.helpfulText}>Was this helpful?</Text>
              <View style={styles.helpfulButtons}>
                <TouchableOpacity
                  style={[styles.helpfulButton, styles.helpfulButtonPositive]}
                  onPress={() => handleHelpfulResponse(true)}
                >
                  <Ionicons name="thumbs-up-outline" size={22} color={Colors.success} />
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.helpfulButton, styles.helpfulButtonNegative]}
                  onPress={() => handleHelpfulResponse(false)}
                >
                  <Ionicons name="thumbs-down-outline" size={22} color={Colors.textMuted} />
                </TouchableOpacity>
              </View>
            </Animated.View>
          )}

          {helpfulResponse !== null && (
            <View style={styles.thankYouSection}>
              <Ionicons name="checkmark-circle" size={20} color={Colors.success} />
              <Text style={styles.thankYouText}>Thanks for your feedback!</Text>
            </View>
          )}

          {/* Community feedback */}
          {isPublic && communityFeedbackData?.feedback && communityFeedbackData.feedback.length > 0 && (
            <View style={styles.communitySection}>
              <View style={styles.communityHeader}>
                <Text style={styles.communitySectionLabel}>Community</Text>
                <View style={styles.communityRule} />
                <Text style={styles.communityScore}>
                  {(outfit.communityAvgScore || 0).toFixed(1)}/10 avg
                  {' '}({communityFeedbackData.feedback.length})
                </Text>
              </View>
              {showCommunityFeedback ? (
                <>
                  {communityFeedbackData.feedback.map((fb) => (
                    <View key={fb.id} style={styles.communityFeedbackItem}>
                      <View style={styles.communityFeedbackItemHeader}>
                        <Text style={styles.communityUsername}>
                          {fb.user.username || fb.user.name || 'Anonymous'}
                        </Text>
                        <Text style={[styles.communityItemScore, { color: getScoreColor(fb.score) }]}>
                          {fb.score}/10
                        </Text>
                      </View>
                      <Text style={styles.communityComment}>{fb.comment}</Text>
                    </View>
                  ))}
                  <TouchableOpacity
                    style={styles.showLessButton}
                    onPress={() => setShowCommunityFeedback(false)}
                  >
                    <Text style={styles.showLessText}>Show Less</Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={styles.showMoreButton}
                  onPress={() => setShowCommunityFeedback(true)}
                >
                  <Text style={styles.showMoreText}>
                    View {communityFeedbackData.feedback.length} feedback{communityFeedbackData.feedback.length !== 1 ? 's' : ''}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          )}

          {/* Share to community — editorial style */}
          <View style={styles.shareSection}>
            <View style={styles.shareRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.shareSectionLabel}>Community</Text>
                <Text style={styles.shareDesc}>
                  {isPublic ? 'Visible in community feed' : 'Share for peer feedback'}
                </Text>
              </View>
              <TouchableOpacity
                style={[styles.shareToggle, isPublic && styles.shareToggleActive]}
                onPress={handleTogglePublic}
                activeOpacity={0.8}
              >
                <View style={[styles.shareThumb, isPublic && styles.shareThumbActive]} />
              </TouchableOpacity>
            </View>
          </View>

          {/* Invite a friend — inline banner, shown after score moment */}
          {referralStats?.link && (
            <View style={styles.inviteSection}>
              <Text style={styles.inviteSectionLabel}>Invite a Friend</Text>
              <View style={styles.inviteRule} />
              <Text style={styles.inviteDesc}>
                Share your link — friends who join give you +1 bonus check
              </Text>
              <View style={styles.inviteLinkRow}>
                <Text style={styles.inviteLinkText} numberOfLines={1}>{referralStats.link}</Text>
                <TouchableOpacity
                  style={styles.inviteShareButton}
                  onPress={async () => {
                    try {
                      await Share.share({
                        message: `Get your outfit scored on Or This? — the AI that tells you exactly what works. Join with my link: ${referralStats.link}`,
                      });
                    } catch { /* dismissed */ }
                  }}
                >
                  <Ionicons name="share-outline" size={16} color={Colors.white} />
                  <Text style={styles.inviteShareButtonText}>Share</Text>
                </TouchableOpacity>
              </View>
            </View>
          )}

          <AdBanner />
          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Sharp-corner action bar */}
        <View style={[styles.actionBar, { paddingBottom: Spacing.md + Math.round(insets.bottom * 0.75) }]}>
          <TouchableOpacity
            style={[styles.iconButton, isFavorite && styles.iconButtonActive]}
            onPress={handleToggleFavorite}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={20}
              color={isFavorite ? Colors.white : Colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareScore}
            disabled={isGeneratingShare}
          >
            {isGeneratingShare ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="share-social" size={18} color={Colors.white} />
                <Text style={styles.shareButtonText}>Share Score</Text>
              </>
            )}
          </TouchableOpacity>
          <TouchableOpacity style={styles.iconButton} onPress={handleNewCheck}>
            <Ionicons name="camera-outline" size={20} color={Colors.text} />
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      <FollowUpModal
        visible={showFollowUp}
        onClose={() => setShowFollowUp(false)}
        feedbackSummary={normalized?.editorialSummary || (feedback as any)?.summary || ''}
        outfitId={outfit.id}
        maxFollowUps={limits?.followUpsPerCheck ?? 3}
        feedback={feedback}
        occasions={outfit.occasions}
        specificConcerns={outfit.specificConcerns}
        existingFollowUps={outfit.followUps}
      />

      {ViewShot && (
        <View style={styles.hiddenShareCard} pointerEvents="none">
          <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 0.95 }}>
            <ShareableScoreCard
              score={score}
              imageUri={imageUri}
              summary={normalized?.editorialSummary || (feedback as any)?.summary || ''}
              occasion={outfit.occasions?.[0]}
              username={user?.name || undefined}
            />
          </ViewShot>
        </View>
      )}
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
    gap: Spacing.sm,
  },
  loadingBackButton: {
    position: 'absolute',
    top: 56,
    left: Spacing.md,
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  loadingDots: {
    flexDirection: 'row',
    gap: 6,
    marginBottom: Spacing.md,
  },
  loadingDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  loadingText: {
    fontFamily: Fonts.serif,
    fontSize: 20,
    color: Colors.text,
  },
  loadingSubtext: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textMuted,
    letterSpacing: 0.3,
  },
  safeArea: {
    flex: 1,
  },
  // Minimal header
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  backButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  followUpHeaderButton: {
    width: 36,
    height: 36,
    justifyContent: 'center',
    alignItems: 'center',
  },
  scrollView: {
    flex: 1,
  },
  // Full-bleed hero image
  heroContainer: {
    width: SCREEN_WIDTH,
    height: Math.min(HERO_HEIGHT, 480),
    position: 'relative',
  },
  heroImage: {
    width: '100%',
    height: '100%',
  },
  heroOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 120,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  scoreOverlay: {
    position: 'absolute',
    bottom: 20,
    left: Spacing.lg,
    flexDirection: 'row',
    alignItems: 'baseline',
  },
  scoreNumber: {
    fontFamily: Fonts.serif,
    fontSize: 56,
    lineHeight: 60,
  },
  scoreOut: {
    fontFamily: Fonts.sans,
    fontSize: 18,
    color: 'rgba(255,255,255,0.8)',
    marginLeft: 4,
  },
  // Summary
  summarySection: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.xl,
  },
  summaryText: {
    fontFamily: Fonts.sans,
    fontSize: 16,
    lineHeight: 26,
    color: Colors.text,
  },
  // Retry banner
  retryBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
    padding: Spacing.md,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
    borderRadius: 4,
    gap: Spacing.sm,
  },
  retryBannerText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.warning,
  },
  retryButton: {
    paddingHorizontal: 14,
    paddingVertical: 7,
    backgroundColor: Colors.warning,
    borderRadius: 0,
    minWidth: 56,
    alignItems: 'center',
  },
  retryButtonText: {
    fontFamily: Fonts.sansBold,
    fontSize: 13,
    color: Colors.white,
  },
  // Feedback items within FeedbackCard
  feedbackItem: {
    gap: 4,
  },
  feedbackItemTitle: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: Colors.text,
  },
  feedbackItemDetail: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  // Follow-up
  followUpSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  followUpButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingVertical: Spacing.md,
    paddingHorizontal: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
    borderRadius: 0, // sharp
  },
  followUpButtonText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
  },
  // Helpful
  helpfulSection: {
    alignItems: 'center',
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
    paddingVertical: Spacing.lg,
    borderTopWidth: 1,
    borderBottomWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    gap: Spacing.sm,
  },
  helpfulText: {
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
  },
  helpfulButtons: {
    flexDirection: 'row',
    gap: Spacing.md,
  },
  helpfulButton: {
    width: 48,
    height: 48,
    borderRadius: 4,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.1)',
  },
  helpfulButtonPositive: {
    backgroundColor: 'rgba(16, 185, 129, 0.08)',
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
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.success,
  },
  // Community section
  communitySection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.xl,
  },
  communityHeader: {
    marginBottom: Spacing.md,
  },
  communitySectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  communityRule: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginBottom: Spacing.sm,
  },
  communityScore: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textMuted,
  },
  communityFeedbackItem: {
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.08)',
  },
  communityFeedbackItemHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  communityUsername: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
    color: Colors.text,
  },
  communityItemScore: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 14,
  },
  communityComment: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.textSecondary,
    lineHeight: 20,
  },
  showMoreButton: {
    paddingVertical: Spacing.sm,
  },
  showMoreText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
  },
  showLessButton: {
    paddingVertical: Spacing.sm,
    marginTop: Spacing.sm,
  },
  showLessText: {
    fontFamily: Fonts.sans,
    fontSize: 14,
    color: Colors.primary,
  },
  // Share to community
  shareSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
  },
  shareRow: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  shareSectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 2,
  },
  shareDesc: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textMuted,
  },
  shareToggle: {
    width: 48,
    height: 28,
    borderRadius: 9999,
    backgroundColor: Colors.surfaceLight,
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  shareToggleActive: {
    backgroundColor: Colors.primary,
  },
  shareThumb: {
    width: 20,
    height: 20,
    borderRadius: 9999,
    backgroundColor: Colors.white,
    alignSelf: 'flex-start',
  },
  shareThumbActive: {
    alignSelf: 'flex-end',
  },
  // Action bar — sharp corners
  actionBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: 'rgba(0,0,0,0.1)',
    backgroundColor: Colors.background,
  },
  iconButton: {
    width: 48,
    height: 48,
    borderRadius: 0, // sharp
    backgroundColor: Colors.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.12)',
  },
  iconButtonActive: {
    backgroundColor: Colors.primary,
    borderColor: Colors.primary,
  },
  shareButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    borderRadius: 0, // sharp — editorial spec
    backgroundColor: Colors.primary,
  },
  shareButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.65,
    color: Colors.white,
  },
  // Bullet rows for v3.0 feedback sections
  bulletRow: {
    flexDirection: 'row',
    gap: 10,
    alignItems: 'flex-start',
  },
  bulletSymbol: {
    fontFamily: Fonts.sansSemiBold,
    fontSize: 15,
    color: Colors.textMuted,
    width: 16,
    lineHeight: 22,
  },
  bulletText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 15,
    color: Colors.text,
    lineHeight: 22,
  },
  // Editorial summary — pull-quote block
  editorialCard: {
    marginHorizontal: 24,
    marginBottom: 32,
    alignItems: 'center',
    gap: 20,
  },
  editorialRule: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
  },
  editorialText: {
    fontFamily: Fonts.serifItalic,
    fontSize: 17,
    lineHeight: 28,
    color: Colors.text,
    textAlign: 'center',
    paddingHorizontal: 8,
  },
  // Invite a friend section
  inviteSection: {
    marginHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
    padding: Spacing.md,
    backgroundColor: Colors.white,
    borderWidth: 1,
    borderColor: 'rgba(0,0,0,0.08)',
    borderRadius: 4,
  },
  inviteSectionLabel: {
    fontFamily: Fonts.sansMedium,
    fontSize: 11,
    textTransform: 'uppercase',
    letterSpacing: 2.2,
    color: Colors.textMuted,
    marginBottom: 8,
  },
  inviteRule: {
    width: 60,
    height: 1,
    backgroundColor: 'rgba(0,0,0,0.12)',
    marginBottom: Spacing.md,
  },
  inviteDesc: {
    fontFamily: Fonts.sans,
    fontSize: 13,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    lineHeight: 20,
  },
  inviteLinkRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  inviteLinkText: {
    flex: 1,
    fontFamily: Fonts.sans,
    fontSize: 12,
    color: Colors.textMuted,
  },
  inviteShareButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 14,
    backgroundColor: Colors.primary,
    borderRadius: 0,
  },
  inviteShareButtonText: {
    fontFamily: Fonts.sansMedium,
    fontSize: 12,
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    color: Colors.white,
  },
  // Off-screen share card
  hiddenShareCard: {
    position: 'absolute',
    left: -1000,
    top: 0,
  },
});
