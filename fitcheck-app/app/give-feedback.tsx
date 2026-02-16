import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Image,
  ActivityIndicator,
  Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useCommunityFeed, useSubmitCommunityFeedback } from '../src/hooks/useApi';
import Slider from '@react-native-community/slider';
import CelebrationModal from '../src/components/CelebrationModal';

export default function GiveFeedbackScreen() {
  const router = useRouter();
  const [currentIndex, setCurrentIndex] = useState(0);
  const [score, setScore] = useState(7);
  const [comment, setComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [celebrationData, setCelebrationData] = useState<any>(null);
  const [showCelebration, setShowCelebration] = useState(false);

  const { data, isLoading, refetch } = useCommunityFeed({
    filter: 'recent',
    limit: 50,
  });

  const submitMutation = useSubmitCommunityFeedback();

  const outfits = data?.outfits || [];
  const currentOutfit = outfits[currentIndex];

  const handleSubmit = async () => {
    if (!currentOutfit) return;
    if (comment.trim().length === 0) {
      Alert.alert('Comment Required', 'Please add a comment with your feedback.');
      return;
    }

    try {
      setIsSubmitting(true);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);

      const result = await submitMutation.mutateAsync({
        outfitId: currentOutfit.id,
        score,
        comment: comment.trim(),
      });

      // Reset for next outfit
      setComment('');
      setScore(7);

      // Check for gamification celebrations
      if (result?.gamification) {
        const { leveledUp, oldLevel, level, newBadges, pointsAwarded } = result.gamification;

        // Level up celebration
        if (leveledUp) {
          const levelNames: Record<number, string> = {
            1: 'Style Newbie',
            2: 'Fashion Friend',
            3: 'Style Advisor',
            4: 'Outfit Expert',
            5: 'Trusted Reviewer',
            6: 'Style Guru',
            7: 'Fashion Icon',
            8: 'Legend',
          };

          setCelebrationData({
            type: 'levelup',
            oldLevel,
            newLevel: level,
            levelName: levelNames[level] || 'Style Enthusiast',
            pointsAwarded,
          });
          setShowCelebration(true);
        }
        // Badge unlock celebration (check after level up dismissal)
        else if (newBadges && newBadges.length > 0) {
          // Show first badge (can queue others if needed)
          const badgeMetadata: Record<string, { name: string; description: string; icon: string }> = {
            helpful_hero: { name: 'Helpful Hero', description: 'Received 50 helpful votes', icon: '⭐' },
            streak_master: { name: 'Streak Master', description: '30-day streak achieved', icon: '🔥' },
            century_club: { name: 'Century Club', description: 'Gave 100 feedbacks', icon: '💯' },
            trusted_reviewer: { name: 'Trusted Reviewer', description: 'Level 5 with quality feedback', icon: '✅' },
            dedicated: { name: 'Dedicated', description: '7-day streak achieved', icon: '🎯' },
          };

          const badgeId = newBadges[0];
          const badge = badgeMetadata[badgeId];

          if (badge) {
            setCelebrationData({
              type: 'badge',
              badgeId,
              badgeName: badge.name,
              badgeDescription: badge.description,
              badgeIcon: badge.icon,
            });
            setShowCelebration(true);
          }
        }
      }

      // Move to next outfit or refetch if we're at the end
      if (currentIndex < outfits.length - 1) {
        setCurrentIndex(currentIndex + 1);
      } else {
        Alert.alert(
          'Thanks for Contributing! 🎉',
          'You\'ve reviewed all available outfits. Come back later for more!',
          [
            {
              text: 'View Community',
              onPress: () => router.replace('/(tabs)/community' as any),
            },
          ]
        );
      }
    } catch (error: any) {
      console.error('Failed to submit feedback:', error);
      Alert.alert(
        'Error',
        error?.response?.data?.error || 'Failed to submit feedback. Please try again.'
      );
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleSkip = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    if (currentIndex < outfits.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setComment('');
      setScore(7);
    } else {
      Alert.alert(
        'No More Outfits',
        'You\'ve seen all available outfits! Come back later for more.',
        [
          {
            text: 'OK',
            onPress: () => router.back(),
          },
        ]
      );
    }
  };

  const getScoreColor = (value: number) => {
    if (value >= 8) return Colors.success;
    if (value >= 6) return Colors.warning;
    return Colors.error;
  };

  const getScoreLabel = (value: number) => {
    if (value >= 9) return '🔥 Amazing';
    if (value >= 8) return '✨ Great';
    if (value >= 7) return '👍 Good';
    if (value >= 6) return '👌 Decent';
    if (value >= 5) return '💭 Okay';
    return '🤔 Needs Work';
  };

  if (isLoading) {
    return (
      <View style={styles.loadingContainer}>
        <ActivityIndicator size="large" color={Colors.primary} />
        <Text style={styles.loadingText}>Loading outfits...</Text>
      </View>
    );
  }

  if (!currentOutfit) {
    return (
      <SafeAreaView style={styles.container} edges={['top']}>
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Give Feedback</Text>
          <View style={{ width: 40 }} />
        </View>

        <View style={styles.emptyContainer}>
          <Text style={styles.emptyIcon}>👕</Text>
          <Text style={styles.emptyTitle}>No Outfits to Review</Text>
          <Text style={styles.emptyText}>
            Check back later when more community members share their outfits!
          </Text>
          <TouchableOpacity
            style={styles.emptyButton}
            onPress={() => router.replace('/(tabs)/community' as any)}
          >
            <Text style={styles.emptyButtonText}>Browse Community</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const imageUri = currentOutfit.thumbnailData
    ? `data:image/jpeg;base64,${currentOutfit.thumbnailData}`
    : currentOutfit.thumbnailUrl;

  return (
    <View style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        {/* Header */}
        <View style={styles.header}>
          <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Give Feedback</Text>
          <TouchableOpacity style={styles.skipButton} onPress={handleSkip}>
            <Text style={styles.skipButtonText}>Skip</Text>
          </TouchableOpacity>
        </View>

        {/* Progress */}
        <View style={styles.progressContainer}>
          <Text style={styles.progressText}>
            {currentIndex + 1} of {outfits.length}
          </Text>
        </View>

        <ScrollView style={styles.scrollView} showsVerticalScrollIndicator={false}>
          {/* Outfit Image */}
          <View style={styles.imageSection}>
            {imageUri && (
              <Image
                source={{ uri: imageUri }}
                style={styles.image}
                resizeMode="cover"
              />
            )}
            <View style={styles.imageOverlay}>
              <View style={styles.userBadge}>
                <Ionicons name="person-outline" size={14} color={Colors.white} />
                <Text style={styles.userBadgeText}>
                  {currentOutfit.user.username || currentOutfit.user.name || 'Anonymous'}
                </Text>
              </View>
            </View>
          </View>

          {/* Context */}
          {currentOutfit.occasions && currentOutfit.occasions.length > 0 && (
            <View style={styles.contextSection}>
              <Text style={styles.contextLabel}>Occasion:</Text>
              <View style={styles.occasionTags}>
                {currentOutfit.occasions.map((occasion, index) => (
                  <View key={index} style={styles.occasionTag}>
                    <Text style={styles.occasionText}>{occasion}</Text>
                  </View>
                ))}
              </View>
            </View>
          )}

          {/* Score Slider */}
          <View style={styles.scoreSection}>
            <Text style={styles.sectionTitle}>Your Score</Text>
            <View style={styles.scoreDisplay}>
              <Text style={[styles.scoreValue, { color: getScoreColor(score) }]}>
                {score}/10
              </Text>
              <Text style={styles.scoreLabel}>{getScoreLabel(score)}</Text>
            </View>
            <Slider
              style={styles.slider}
              minimumValue={1}
              maximumValue={10}
              step={1}
              value={score}
              onValueChange={setScore}
              minimumTrackTintColor={getScoreColor(score)}
              maximumTrackTintColor={Colors.border}
              thumbTintColor={getScoreColor(score)}
            />
            <View style={styles.sliderLabels}>
              <Text style={styles.sliderLabel}>1</Text>
              <Text style={styles.sliderLabel}>10</Text>
            </View>
          </View>

          {/* Comment */}
          <View style={styles.commentSection}>
            <Text style={styles.sectionTitle}>Your Feedback</Text>
            <Text style={styles.sectionSubtitle}>
              What's working? What could be improved?
            </Text>
            <TextInput
              style={styles.commentInput}
              placeholder="Share your thoughts (be kind and constructive)..."
              placeholderTextColor={Colors.textMuted}
              multiline
              numberOfLines={4}
              value={comment}
              onChangeText={setComment}
              maxLength={500}
              textAlignVertical="top"
            />
            <Text style={styles.characterCount}>{comment.length}/500</Text>
          </View>

          {/* Quick Suggestions */}
          <View style={styles.suggestionsSection}>
            <Text style={styles.sectionSubtitle}>Quick suggestions:</Text>
            <View style={styles.suggestionButtons}>
              {[
                'Great color combo!',
                'Love the fit',
                'Try different shoes',
                'Consider accessories',
                'Perfect for the occasion',
              ].map((suggestion, index) => (
                <TouchableOpacity
                  key={index}
                  style={styles.suggestionButton}
                  onPress={() => {
                    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setComment((prev) =>
                      prev ? `${prev} ${suggestion}` : suggestion
                    );
                  }}
                >
                  <Text style={styles.suggestionButtonText}>{suggestion}</Text>
                </TouchableOpacity>
              ))}
            </View>
          </View>

          <View style={{ height: 120 }} />
        </ScrollView>

        {/* Submit Button */}
        <View style={styles.bottomBar}>
          <TouchableOpacity
            style={[
              styles.submitButton,
              (isSubmitting || comment.trim().length === 0) && styles.submitButtonDisabled,
            ]}
            onPress={handleSubmit}
            disabled={isSubmitting || comment.trim().length === 0}
          >
            {isSubmitting ? (
              <ActivityIndicator size="small" color={Colors.white} />
            ) : (
              <>
                <Ionicons name="checkmark-circle" size={24} color={Colors.white} />
                <Text style={styles.submitButtonText}>Submit Feedback</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      </SafeAreaView>

      {/* Celebration Modal */}
      <CelebrationModal
        visible={showCelebration}
        data={celebrationData}
        onDismiss={() => {
          setShowCelebration(false);
          setCelebrationData(null);
        }}
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
    fontSize: FontSize.md,
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
    borderRadius: BorderRadius.full,
  },
  headerTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
  },
  skipButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
  },
  skipButtonText: {
    fontSize: FontSize.md,
    fontWeight: '600',
    color: Colors.primary,
  },
  progressContainer: {
    paddingHorizontal: Spacing.lg,
    paddingVertical: Spacing.sm,
    alignItems: 'center',
  },
  progressText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  scrollView: {
    flex: 1,
  },
  imageSection: {
    width: '100%',
    aspectRatio: 3 / 4,
    position: 'relative',
    marginBottom: Spacing.lg,
  },
  image: {
    width: '100%',
    height: '100%',
  },
  imageOverlay: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: Spacing.md,
  },
  userBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    alignSelf: 'flex-start',
    paddingHorizontal: 12,
    paddingVertical: 6,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    borderRadius: BorderRadius.full,
  },
  userBadgeText: {
    fontSize: FontSize.sm,
    color: Colors.white,
    fontWeight: '600',
  },
  contextSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  contextLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.sm,
    fontWeight: '600',
  },
  occasionTags: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  occasionTag: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.xs,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  occasionText: {
    fontSize: FontSize.sm,
    color: Colors.text,
    fontWeight: '600',
  },
  scoreSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.lg,
  },
  sectionTitle: {
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
  },
  sectionSubtitle: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    marginBottom: Spacing.md,
  },
  scoreDisplay: {
    alignItems: 'center',
    marginBottom: Spacing.md,
  },
  scoreValue: {
    fontSize: 48,
    fontWeight: '700',
    marginBottom: 4,
  },
  scoreLabel: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  slider: {
    width: '100%',
    height: 40,
  },
  sliderLabels: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.xs,
  },
  sliderLabel: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    fontWeight: '600',
  },
  commentSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  commentInput: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    fontSize: FontSize.md,
    color: Colors.text,
    minHeight: 120,
    borderWidth: 1,
    borderColor: Colors.border,
  },
  characterCount: {
    fontSize: FontSize.xs,
    color: Colors.textMuted,
    textAlign: 'right',
    marginTop: Spacing.xs,
  },
  suggestionsSection: {
    paddingHorizontal: Spacing.lg,
    marginBottom: Spacing.md,
  },
  suggestionButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.sm,
    marginTop: Spacing.sm,
  },
  suggestionButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  suggestionButtonText: {
    fontSize: FontSize.sm,
    color: Colors.primary,
    fontWeight: '600',
  },
  bottomBar: {
    padding: Spacing.lg,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    backgroundColor: Colors.background,
  },
  submitButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: Spacing.sm,
    paddingVertical: 16,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 8,
  },
  submitButtonDisabled: {
    backgroundColor: Colors.surfaceLight,
    shadowOpacity: 0,
    elevation: 0,
  },
  submitButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: Spacing.xxl,
  },
  emptyIcon: {
    fontSize: 64,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: FontSize.xl,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptyText: {
    fontSize: FontSize.md,
    color: Colors.textMuted,
    textAlign: 'center',
    marginBottom: Spacing.xl,
    lineHeight: 22,
  },
  emptyButton: {
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    backgroundColor: Colors.primary,
    borderRadius: BorderRadius.full,
  },
  emptyButtonText: {
    fontSize: FontSize.md,
    fontWeight: '700',
    color: Colors.white,
  },
});
