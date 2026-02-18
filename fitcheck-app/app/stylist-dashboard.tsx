import { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Alert,
  Image,
  ScrollView,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { Colors, Spacing, FontSize, BorderRadius } from '../src/constants/theme';
import { useMyStylistProfile, useStylistQueue, useSubmitExpertReview } from '../src/hooks/useApi';

type Tab = 'queue' | 'completed';

export default function StylistDashboardScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<Tab>('queue');
  const [expandedReviewId, setExpandedReviewId] = useState<string | null>(null);
  const [scores, setScores] = useState<Record<string, string>>({});
  const [feedbacks, setFeedbacks] = useState<Record<string, string>>({});

  const { data: profileData, isLoading: profileLoading, isError: profileError } =
    useMyStylistProfile();
  const { data: queueData, isLoading: queueLoading, refetch } = useStylistQueue();
  const submitMutation = useSubmitExpertReview();

  // Gate: not a stylist
  if (profileLoading) {
    return (
      <View style={styles.centered}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (profileError || !profileData?.stylist?.verified) {
    return (
      <SafeAreaView style={styles.container}>
        <View style={styles.header}>
          <TouchableOpacity onPress={() => router.back()}>
            <Ionicons name="arrow-back" size={24} color={Colors.text} />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Stylist Dashboard</Text>
          <View style={{ width: 24 }} />
        </View>
        <View style={styles.centered}>
          <Ionicons name="ribbon-outline" size={48} color={Colors.textMuted} />
          <Text style={styles.emptyTitle}>Not a verified stylist</Text>
          <Text style={styles.emptyText}>
            Apply to become a stylist to access your dashboard.
          </Text>
          <TouchableOpacity
            style={styles.applyButton}
            onPress={() => router.push('/become-stylist' as any)}
          >
            <Text style={styles.applyButtonText}>Apply Now</Text>
          </TouchableOpacity>
        </View>
      </SafeAreaView>
    );
  }

  const stylist = profileData.stylist;
  const allReviews = queueData?.reviews || [];
  const queueReviews = allReviews.filter((r: any) => r.status === 'pending' || r.status === 'in_progress');
  const completedReviews = allReviews.filter((r: any) => r.status === 'completed');

  const handleSubmit = async (reviewId: string) => {
    const scoreStr = scores[reviewId] ?? '';
    const feedback = feedbacks[reviewId] ?? '';
    const score = parseInt(scoreStr, 10);

    if (isNaN(score) || score < 1 || score > 10) {
      Alert.alert('Invalid Score', 'Please enter a score between 1 and 10.');
      return;
    }
    if (feedback.trim().length < 50) {
      Alert.alert('Feedback Too Short', 'Please write at least 50 characters of feedback.');
      return;
    }

    try {
      await submitMutation.mutateAsync({ reviewId, score, feedback: feedback.trim() });
      setExpandedReviewId(null);
      setScores((prev) => { const n = { ...prev }; delete n[reviewId]; return n; });
      setFeedbacks((prev) => { const n = { ...prev }; delete n[reviewId]; return n; });
      Alert.alert('Review Submitted', 'Your expert review has been sent to the requester.');
    } catch (err: any) {
      Alert.alert('Error', err?.response?.data?.error || 'Failed to submit review.');
    }
  };

  const renderQueueItem = ({ item }: { item: any }) => {
    const isExpanded = expandedReviewId === item.id;
    const outfit = item.outfitCheck;
    const imageUri = outfit?.thumbnailUrl ||
      (outfit?.thumbnailData ? `data:image/jpeg;base64,${outfit.thumbnailData}` : null) ||
      outfit?.imageUrl ||
      (outfit?.imageData ? `data:image/jpeg;base64,${outfit.imageData}` : null);
    const scoreVal = scores[item.id] ?? '';
    const feedbackVal = feedbacks[item.id] ?? '';

    return (
      <View style={styles.reviewCard}>
        <View style={styles.reviewCardHeader}>
          {imageUri && (
            <Image source={{ uri: imageUri }} style={styles.outfitThumb} resizeMode="cover" />
          )}
          <View style={styles.reviewCardInfo}>
            <Text style={styles.reviewRequester}>
              @{item.user?.username || item.user?.name || 'Anonymous'}
            </Text>
            {outfit?.occasions?.length > 0 && (
              <Text style={styles.reviewOccasion}>{outfit.occasions.join(', ')}</Text>
            )}
            {outfit?.specificConcerns && (
              <Text style={styles.reviewConcern} numberOfLines={2}>
                "{outfit.specificConcerns}"
              </Text>
            )}
            <Text style={styles.reviewDate}>
              {new Date(item.requestedAt).toLocaleDateString()}
            </Text>
          </View>
          <TouchableOpacity
            style={[styles.reviewButton, isExpanded && styles.reviewButtonActive]}
            onPress={() => setExpandedReviewId(isExpanded ? null : item.id)}
          >
            <Text style={[styles.reviewButtonText, isExpanded && styles.reviewButtonTextActive]}>
              {isExpanded ? 'Cancel' : 'Review'}
            </Text>
          </TouchableOpacity>
        </View>

        {isExpanded && (
          <View style={styles.reviewForm}>
            {outfit?.aiScore != null && (
              <Text style={styles.aiScoreHint}>AI Score: {outfit.aiScore}/10</Text>
            )}
            <Text style={styles.formLabel}>Your Score (1–10)</Text>
            <TextInput
              style={styles.scoreInput}
              value={scoreVal}
              onChangeText={(v) => setScores((prev) => ({ ...prev, [item.id]: v }))}
              keyboardType="number-pad"
              maxLength={2}
              placeholder="e.g. 8"
              placeholderTextColor={Colors.textMuted}
            />
            <Text style={styles.formLabel}>
              Expert Feedback ({feedbackVal.length}/3000, min 50)
            </Text>
            <TextInput
              style={styles.feedbackInput}
              value={feedbackVal}
              onChangeText={(v) => setFeedbacks((prev) => ({ ...prev, [item.id]: v }))}
              multiline
              maxLength={3000}
              placeholder="Share your expert assessment..."
              placeholderTextColor={Colors.textMuted}
              textAlignVertical="top"
            />
            <TouchableOpacity
              style={[
                styles.submitButton,
                (submitMutation.isPending) && styles.submitButtonDisabled,
              ]}
              onPress={() => handleSubmit(item.id)}
              disabled={submitMutation.isPending}
            >
              {submitMutation.isPending ? (
                <ActivityIndicator size="small" color={Colors.white} />
              ) : (
                <Text style={styles.submitButtonText}>Submit Review</Text>
              )}
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const renderCompletedItem = ({ item }: { item: any }) => (
    <View style={styles.completedCard}>
      <View style={styles.completedRow}>
        <Text style={styles.completedRequester}>
          @{item.user?.username || item.user?.name || 'Anonymous'}
        </Text>
        <View style={styles.completedScore}>
          <Text style={styles.completedScoreText}>{item.score}/10</Text>
        </View>
      </View>
      <Text style={styles.completedFeedback} numberOfLines={3}>{item.feedback}</Text>
      <Text style={styles.completedDate}>
        {new Date(item.completedAt).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={Colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Stylist Dashboard</Text>
        <View style={{ width: 24 }} />
      </View>

      {/* Stats bar */}
      <View style={styles.statsBar}>
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{stylist.reviewCount || 0}</Text>
          <Text style={styles.statLabel}>Reviews</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>
            {stylist.rating ? stylist.rating.toFixed(1) : '—'}
          </Text>
          <Text style={styles.statLabel}>Avg Rating</Text>
        </View>
        <View style={styles.statDivider} />
        <View style={styles.statItem}>
          <Text style={styles.statValue}>{queueReviews.length}</Text>
          <Text style={styles.statLabel}>Pending</Text>
        </View>
      </View>

      {/* Tabs */}
      <View style={styles.tabs}>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'queue' && styles.tabActive]}
          onPress={() => setActiveTab('queue')}
        >
          <Text style={[styles.tabText, activeTab === 'queue' && styles.tabTextActive]}>
            Queue ({queueReviews.length})
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.tab, activeTab === 'completed' && styles.tabActive]}
          onPress={() => setActiveTab('completed')}
        >
          <Text style={[styles.tabText, activeTab === 'completed' && styles.tabTextActive]}>
            Completed ({completedReviews.length})
          </Text>
        </TouchableOpacity>
      </View>

      {queueLoading ? (
        <View style={styles.centered}>
          <ActivityIndicator size="large" color={Colors.primary} />
        </View>
      ) : activeTab === 'queue' ? (
        <FlatList
          data={queueReviews}
          keyExtractor={(item) => item.id}
          renderItem={renderQueueItem}
          contentContainerStyle={styles.list}
          refreshing={queueLoading}
          onRefresh={refetch}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Ionicons name="checkmark-circle-outline" size={48} color={Colors.textMuted} />
              <Text style={styles.emptyTitle}>Queue is empty</Text>
              <Text style={styles.emptyText}>No pending reviews right now.</Text>
            </View>
          }
        />
      ) : (
        <FlatList
          data={completedReviews}
          keyExtractor={(item) => item.id}
          renderItem={renderCompletedItem}
          contentContainerStyle={styles.list}
          ListEmptyComponent={
            <View style={styles.emptyState}>
              <Text style={styles.emptyTitle}>No completed reviews yet</Text>
            </View>
          }
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: Colors.background },
  centered: { flex: 1, justifyContent: 'center', alignItems: 'center', padding: Spacing.xl },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  headerTitle: { fontSize: FontSize.lg, fontWeight: '700', color: Colors.text },
  statsBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-around',
    paddingVertical: Spacing.md,
    backgroundColor: Colors.surface,
    borderBottomWidth: 1,
    borderBottomColor: Colors.border,
  },
  statItem: { alignItems: 'center' },
  statValue: { fontSize: FontSize.xl, fontWeight: '700', color: Colors.text },
  statLabel: { fontSize: FontSize.xs, color: Colors.textMuted, marginTop: 2 },
  statDivider: { width: 1, height: 32, backgroundColor: Colors.border },
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
  tabText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.textMuted },
  tabTextActive: { color: Colors.primary },
  list: { padding: Spacing.md, gap: Spacing.md },
  // Queue card
  reviewCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    overflow: 'hidden',
  },
  reviewCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: Spacing.md,
    gap: Spacing.md,
  },
  outfitThumb: {
    width: 64,
    height: 80,
    borderRadius: BorderRadius.md,
    backgroundColor: Colors.border,
  },
  reviewCardInfo: { flex: 1, gap: 3 },
  reviewRequester: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  reviewOccasion: { fontSize: FontSize.sm, color: Colors.textMuted },
  reviewConcern: { fontSize: FontSize.sm, color: Colors.text, fontStyle: 'italic' },
  reviewDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  reviewButton: {
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    borderRadius: BorderRadius.full,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  reviewButtonActive: { backgroundColor: Colors.primary },
  reviewButtonText: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.primary },
  reviewButtonTextActive: { color: Colors.white },
  // Review form
  reviewForm: {
    paddingHorizontal: Spacing.md,
    paddingBottom: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.border,
    gap: Spacing.sm,
  },
  aiScoreHint: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    paddingTop: Spacing.sm,
  },
  formLabel: { fontSize: FontSize.sm, fontWeight: '600', color: Colors.text },
  scoreInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.lg,
    fontWeight: '700',
    color: Colors.text,
    width: 80,
  },
  feedbackInput: {
    backgroundColor: Colors.background,
    borderRadius: BorderRadius.md,
    borderWidth: 1,
    borderColor: Colors.border,
    paddingHorizontal: Spacing.md,
    paddingVertical: Spacing.sm,
    fontSize: FontSize.md,
    color: Colors.text,
    height: 140,
  },
  submitButton: {
    backgroundColor: Colors.primary,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
    alignItems: 'center',
  },
  submitButtonDisabled: { opacity: 0.6 },
  submitButtonText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
  // Completed card
  completedCard: {
    backgroundColor: Colors.surface,
    borderRadius: BorderRadius.lg,
    padding: Spacing.md,
    gap: Spacing.xs,
  },
  completedRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  completedRequester: { fontSize: FontSize.md, fontWeight: '600', color: Colors.text },
  completedScore: {
    paddingHorizontal: Spacing.sm,
    paddingVertical: 4,
    backgroundColor: Colors.primaryAlpha10,
    borderRadius: BorderRadius.md,
  },
  completedScoreText: { fontSize: FontSize.sm, fontWeight: '700', color: Colors.primary },
  completedFeedback: { fontSize: FontSize.sm, color: Colors.textSecondary, lineHeight: 20 },
  completedDate: { fontSize: FontSize.xs, color: Colors.textMuted },
  // Empty state
  emptyState: { alignItems: 'center', paddingVertical: Spacing.xxl, gap: Spacing.sm },
  emptyTitle: { fontSize: FontSize.lg, fontWeight: '600', color: Colors.text },
  emptyText: {
    fontSize: FontSize.sm,
    color: Colors.textMuted,
    textAlign: 'center',
    lineHeight: 20,
  },
  applyButton: {
    marginTop: Spacing.md,
    backgroundColor: Colors.primary,
    paddingHorizontal: Spacing.xl,
    paddingVertical: Spacing.md,
    borderRadius: BorderRadius.full,
  },
  applyButtonText: { fontSize: FontSize.md, fontWeight: '700', color: Colors.white },
});
