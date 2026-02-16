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
import * as Sharing from 'expo-sharing';
import ViewShot from 'react-native-view-shot';
import { useAppStore } from '../src/stores/auth';
import { useSubscriptionStore } from '../src/stores/subscriptionStore';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import ScoreDisplay from '../src/components/ScoreDisplay';
import FeedbackCard from '../src/components/FeedbackCard';
import FollowUpModal from '../src/components/FollowUpModal';
import StyleDNACard from '../src/components/StyleDNACard';
import ShareableScoreCard from '../src/components/ShareableScoreCard';
import { outfitService, type OutfitCheck } from '../src/services/api.service';
import { useTogglePublic } from '../src/hooks/useApi';
import { useAuthStore } from '../src/stores/authStore';

export default function FeedbackScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const outfitId = params.outfitId as string;

  const { resetCheckFlow } = useAppStore();
  const { limits } = useSubscriptionStore();
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

  const fadeAnim = useRef(new Animated.Value(0)).current;
  const pollInterval = useRef<NodeJS.Timeout | null>(null);
  const viewShotRef = useRef<ViewShot>(null);

  // Handle hardware back button
  useEffect(() => {
    const backHandler = BackHandler.addEventListener('hardwareBackPress', () => {
      handleGoHome();
      return true; // Prevent default back behavior
    });

    return () => backHandler.remove();
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
    if (!outfit || !viewShotRef.current) return;

    try {
      setIsGeneratingShare(true);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

      // Small delay to ensure image is loaded
      await new Promise(resolve => setTimeout(resolve, 100));

      // Capture the shareable card as an image
      const uri = await viewShotRef.current.capture?.();

      if (!uri) {
        throw new Error('Failed to generate share image');
      }

      // Check if sharing is available
      const isAvailable = await Sharing.isAvailableAsync();

      if (isAvailable) {
        // Share the image to social media (Instagram, TikTok, etc.)
        await Sharing.shareAsync(uri, {
          mimeType: 'image/png',
          dialogTitle: 'Share to Social Media',
        });
      } else {
        // Fallback to text sharing on platforms that don't support image sharing
        const scoreEmoji = score >= 8 ? '🔥' : score >= 6 ? '✨' : '💭';
        await Share.share({
          message: `Or This? Score: ${scoreEmoji} ${score}/10\n\n${feedback.summary}\n\nGet your outfit scored at OrThis.app!`,
          title: `My Or This? Score: ${score}/10`,
        });
      }
    } catch (error: any) {
      console.error('Failed to share score:', error);
      if (error.message !== 'User cancelled') {
        Alert.alert('Error', 'Failed to generate share image. Please try again.');
      }
    } finally {
      setIsGeneratingShare(false);
    }
  };

  const handleFollowUp = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
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

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={handleGoHome}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Your Feedback</Text>
          <TouchableOpacity
            style={styles.shareButton}
            onPress={handleShareScore}
            disabled={isGeneratingShare}
          >
            {isGeneratingShare ? (
              <ActivityIndicator size="small" color={Colors.text} />
            ) : (
              <Ionicons name="share-outline" size={24} color={Colors.text} />
            )}
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
                    Add to Community Feed and get feedback from others
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
                    {isPublic ? 'In Community' : 'Add to Community'}
                  </Text>
                </TouchableOpacity>
              </LinearGradient>
            </View>
          ) : (
            // Lower score: Secondary option
            <View style={styles.shareSecondaryContainer}>
              <View style={styles.shareSecondaryRow}>
                <View>
                  <Text style={styles.shareSecondaryTitle}>Add to Community Feed</Text>
                  <Text style={styles.shareSecondaryDesc}>
                    Let others see and comment on your outfit
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

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Action bar */}
        <View style={styles.actionBar}>
          <TouchableOpacity style={styles.actionButtonSecondary} onPress={handleFollowUp}>
            <Ionicons name="chatbubble-outline" size={20} color={Colors.primary} />
            <Text style={styles.actionButtonSecondaryText}>Follow-up</Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.favoriteCircle, isFavorite && styles.favoriteCircleActive]}
            onPress={handleToggleFavorite}
          >
            <Ionicons
              name={isFavorite ? 'heart' : 'heart-outline'}
              size={24}
              color={isFavorite ? Colors.white : Colors.text}
            />
          </TouchableOpacity>
          <TouchableOpacity style={styles.actionButtonPrimary} onPress={handleNewCheck}>
            <Ionicons name="camera" size={20} color={Colors.white} />
            <Text style={styles.actionButtonPrimaryText}>New Check</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Off-screen shareable card for image generation */}
      <View style={styles.offscreenContainer}>
        <ViewShot ref={viewShotRef} options={{ format: 'png', quality: 1.0 }}>
          <ShareableScoreCard
            score={score}
            imageUri={imageUri}
            summary={feedback.summary}
            occasion={outfit.occasions?.[0]}
            username={user?.username || user?.email?.split('@')[0]}
          />
        </ViewShot>
      </View>

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
  shareButton: {
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
  actionButtonSecondary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  actionButtonSecondaryText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  favoriteCircle: {
    width: 56,
    height: 56,
    borderRadius: 9999,
    backgroundColor: Colors.surface,
    justifyContent: 'center',
    alignItems: 'center',
  },
  favoriteCircleActive: {
    backgroundColor: Colors.secondary,
  },
  actionButtonPrimary: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
  },
  actionButtonPrimaryText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.white,
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
  offscreenContainer: {
    position: 'absolute',
    left: -9999,
    top: -9999,
    opacity: 0,
  },
});
