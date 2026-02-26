import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, outfitService, userService, socialService, notificationService, subscriptionService, comparisonService, expertReviewService, challengeService, wardrobeService, eventService, referralService, OutfitCheckInput, WardrobeCategory, EventDressCode, EventType, WardrobeProgress, EventFollowUpResponse } from '../services/api.service';

// Query keys
export const queryKeys = {
  user: ['user'],
  userStats: ['user', 'stats'],
  outfit: (id: string) => ['outfit', id],
  outfits: (filters?: any) => ['outfits', filters],
  outfitMemory: (occasions: string[]) => ['outfit', 'memory', occasions.sort().join(',')],
  communityFeed: (filters?: any) => ['community', 'feed', filters],
  communityFeedback: (outfitId: string) => ['community', 'feedback', outfitId],
  publicUser: (userId: string) => ['community', 'user', userId],
  followers: (username: string) => ['community', 'followers', username],
  following: (username: string) => ['community', 'following', username],
  leaderboard: (type: string) => ['community', 'leaderboard', type],
  notifications: (unreadOnly?: boolean) => ['notifications', unreadOnly],
  subscriptionStatus: ['subscription', 'status'],
  comparisonFeed: (params?: any) => ['comparisons', 'feed', params],
  contextPreferences: ['user', 'context-preferences'],
};

// User hooks
export function useUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => userService.getProfile(),
  });
}

export function useContextPreferences() {
  return useQuery({
    queryKey: queryKeys.contextPreferences,
    queryFn: () => userService.getContextPreferences(),
    staleTime: 10 * 60 * 1000, // 10 minutes — preferences don't change often
  });
}

export function useUserStats() {
  return useQuery({
    queryKey: queryKeys.userStats,
    queryFn: () => userService.getStats(),
  });
}

export function useUpdateProfile() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof userService.updateProfile>[0]) =>
      userService.updateProfile(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
    },
  });
}

// Outfit hooks
export function useOutfit(id: string) {
  return useQuery({
    queryKey: queryKeys.outfit(id),
    queryFn: () => outfitService.getOutfit(id),
    enabled: !!id,
  });
}

export function useOutfitMemory(occasions: string[]) {
  return useQuery({
    queryKey: queryKeys.outfitMemory(occasions),
    queryFn: () => outfitService.getOutfitMemory(occasions),
    enabled: occasions.length > 0,
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
}

export function useRespondToEventFollowUp() {
  return useMutation({
    mutationFn: ({ followUpId, response }: { followUpId: string; response: EventFollowUpResponse }) =>
      outfitService.respondToEventFollowUp(followUpId, response),
  });
}

export function useOutfits(filters?: {
  occasion?: string;
  isFavorite?: boolean;
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.outfits(filters),
    queryFn: () => outfitService.listOutfits(filters),
  });
}

export function useSubmitOutfitCheck() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (input: OutfitCheckInput) => outfitService.submitCheck(input),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outfits() });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
      queryClient.invalidateQueries({ queryKey: ['wardrobe'] });
      queryClient.invalidateQueries({ queryKey: ['wardrobeProgress'] });
    },
  });
}

export function useSubmitFollowUp(outfitId: string) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (question: string) => outfitService.submitFollowUp(outfitId, question),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outfit(outfitId) });
    },
  });
}

export function useToggleFavorite() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (outfitId: string) => outfitService.toggleFavorite(outfitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outfits() });
    },
  });
}

export function useTogglePublic() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (outfitId: string) => outfitService.togglePublic(outfitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outfits() });
      queryClient.invalidateQueries({ queryKey: queryKeys.communityFeed() });
    },
  });
}

export function useRateFeedback() {
  return useMutation({
    mutationFn: ({
      outfitId,
      helpful,
      rating,
    }: {
      outfitId: string;
      helpful: boolean;
      rating?: number;
    }) => outfitService.rateFeedback(outfitId, helpful, rating),
  });
}

export function useDeleteOutfit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (outfitId: string) => outfitService.deleteOutfit(outfitId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outfits() });
    },
  });
}

export function useReanalyzeOutfit() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (outfitId: string) => outfitService.reanalyzeOutfit(outfitId),
    onSuccess: (_data, outfitId) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.outfit(outfitId) });
      queryClient.invalidateQueries({ queryKey: queryKeys.outfits() });
    },
  });
}

// Community/Social hooks
export function useCommunityFeed(filters?: {
  filter?: 'recent' | 'popular' | 'top-rated';
  limit?: number;
  offset?: number;
}) {
  return useQuery({
    queryKey: queryKeys.communityFeed(filters),
    queryFn: () => socialService.getCommunityFeed(filters),
  });
}

export function useSubmitCommunityFeedback() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ outfitId, score, comment }: { outfitId: string; score: number; comment: string }) =>
      socialService.submitCommunityFeedback(outfitId, score, comment),
    onSuccess: (_, variables) => {
      queryClient.invalidateQueries({ queryKey: queryKeys.communityFeed() });
      queryClient.invalidateQueries({ queryKey: queryKeys.communityFeedback(variables.outfitId) });
    },
  });
}

export function useCommunityFeedback(outfitId: string) {
  return useQuery({
    queryKey: queryKeys.communityFeedback(outfitId),
    queryFn: () => socialService.getOutfitFeedback(outfitId),
    enabled: !!outfitId,
  });
}

export function usePublicUserProfile(usernameOrId: string) {
  return useQuery({
    queryKey: queryKeys.publicUser(usernameOrId),
    queryFn: () => socialService.getUserProfileByUsername(usernameOrId),
    enabled: !!usernameOrId,
  });
}

// Following hooks
export function useFollowUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (username: string) => socialService.followUser(username),
    onSuccess: (_, username) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'followers'] });
      queryClient.invalidateQueries({ queryKey: ['community', 'following'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.publicUser(username) });
    },
  });
}

export function useUnfollowUser() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (username: string) => socialService.unfollowUser(username),
    onSuccess: (_, username) => {
      queryClient.invalidateQueries({ queryKey: ['community', 'followers'] });
      queryClient.invalidateQueries({ queryKey: ['community', 'following'] });
      queryClient.invalidateQueries({ queryKey: queryKeys.publicUser(username) });
    },
  });
}

export function useFollowers(username: string) {
  return useQuery({
    queryKey: queryKeys.followers(username) as readonly unknown[],
    queryFn: () => socialService.getFollowers(username),
    enabled: !!username,
  });
}

export function useFollowing(username: string) {
  return useQuery({
    queryKey: queryKeys.following(username) as readonly unknown[],
    queryFn: () => socialService.getFollowing(username),
    enabled: !!username,
  });
}

export function useLeaderboard(type: string, limit?: number) {
  return useQuery({
    queryKey: queryKeys.leaderboard(type) as readonly unknown[],
    queryFn: () => socialService.getLeaderboard(type, limit),
    enabled: !!type,
  });
}

export function useBadges() {
  return useQuery({
    queryKey: ['badges'] as const,
    queryFn: async () => {
      const response = await api.get('/api/user/badges');
      return response.data as { badges: Array<{ id: string; name: string; description: string; icon: string }>; totalBadges: number };
    },
    staleTime: 5 * 60 * 1000,
  });
}

export function useDailyGoals() {
  return useQuery({
    queryKey: ['dailyGoals'] as const,
    queryFn: async () => {
      const response = await api.get('/api/user/daily-goals');
      return response.data as {
        feedbacksGiven: number;
        feedbacksGoal: number;
        helpfulVotes: number;
        helpfulGoal: number;
        streakMaintained: boolean;
        currentStreak: number;
      };
    },
    staleTime: 60 * 1000,
  });
}

// Notification hooks
export function useNotifications(unreadOnly: boolean = false) {
  return useQuery({
    queryKey: queryKeys.notifications(unreadOnly) as readonly unknown[],
    queryFn: () => notificationService.getNotifications(unreadOnly),
    refetchInterval: 30000, // Refetch every 30 seconds
  });
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (notificationId: string) => notificationService.markAsRead(notificationId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: () => notificationService.markAllAsRead(),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['notifications'] });
    },
  });
}

// Comparison hooks
export function useComparisonFeed(params: { limit?: number; offset?: number } = {}) {
  return useQuery({
    queryKey: queryKeys.comparisonFeed(params),
    queryFn: () => comparisonService.getFeed(params),
  });
}

export function useCreateComparison() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof comparisonService.createPost>[0]) =>
      comparisonService.createPost(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparisons'] });
    },
  });
}

export function useVoteOnComparison() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ postId, choice }: { postId: string; choice: 'A' | 'B' }) =>
      comparisonService.vote(postId, choice),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['comparisons'] });
    },
  });
}

// Expert Review hooks
export function useOutfitExpertReview(outfitId: string) {
  return useQuery({
    queryKey: ['expertReview', 'outfit', outfitId],
    queryFn: () => expertReviewService.getOutfitReview(outfitId),
    enabled: !!outfitId,
  });
}

export function useMyExpertReviews() {
  return useQuery({
    queryKey: ['expertReviews', 'myRequests'],
    queryFn: () => expertReviewService.getMyReviews(),
  });
}

export function useRequestExpertReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ outfitCheckId, stylistId }: { outfitCheckId: string; stylistId?: string }) =>
      expertReviewService.requestReview(outfitCheckId, stylistId),
    onSuccess: (_, { outfitCheckId }) => {
      queryClient.invalidateQueries({ queryKey: ['expertReview', 'outfit', outfitCheckId] });
      queryClient.invalidateQueries({ queryKey: ['expertReviews'] });
    },
  });
}

export function useStylists(params?: { specialty?: string }) {
  return useQuery({
    queryKey: ['stylists', params],
    queryFn: () => expertReviewService.getStylists(params),
  });
}

// Stylist dashboard hooks
export function useMyStylistProfile() {
  return useQuery({
    queryKey: ['stylist', 'me'],
    queryFn: () => expertReviewService.getMyStylistProfile(),
    retry: false, // 403 means not a stylist — don't retry
  });
}

export function useStylistQueue() {
  return useQuery({
    queryKey: ['stylist', 'queue'],
    queryFn: () => expertReviewService.getStylistQueue(),
  });
}

export function useSubmitExpertReview() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: ({ reviewId, score, feedback }: { reviewId: string; score: number; feedback: string }) =>
      expertReviewService.submitReview(reviewId, { score, feedback }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['stylist', 'queue'] });
    },
  });
}

// Subscription hooks
export function useSubscriptionStatus() {
  return useQuery({
    queryKey: queryKeys.subscriptionStatus,
    queryFn: () => subscriptionService.getSubscriptionStatus(),
  });
}

export function useSyncSubscription() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (data: Parameters<typeof subscriptionService.syncSubscription>[0]) =>
      subscriptionService.syncSubscription(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: queryKeys.subscriptionStatus });
      queryClient.invalidateQueries({ queryKey: queryKeys.user });
      queryClient.invalidateQueries({ queryKey: queryKeys.userStats });
    },
  });
}

// Challenge hooks
export function useActiveChallenge() {
  return useQuery({
    queryKey: ['challenge', 'active'],
    queryFn: () => challengeService.getActiveChallenge(),
    staleTime: 60_000, // 1 min — challenge status changes slowly
  });
}

export function useChallenges(status: 'active' | 'upcoming' | 'ended') {
  return useQuery({
    queryKey: ['challenges', status],
    queryFn: () => challengeService.listChallenges(status),
    staleTime: 60_000,
  });
}

export function useChallengeLeaderboard(challengeId: string | undefined) {
  return useQuery({
    queryKey: ['challenge', 'leaderboard', challengeId],
    queryFn: () => challengeService.getLeaderboard(challengeId!, { limit: 10 }),
    enabled: !!challengeId,
    staleTime: 30_000,
  });
}

export function useMySubmission(challengeId: string | undefined) {
  return useQuery({
    queryKey: ['challenge', 'my-submission', challengeId],
    queryFn: () => challengeService.getMySubmission(challengeId!),
    enabled: !!challengeId,
  });
}

export function useSubmitChallengeEntry() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, outfitCheckId }: { challengeId: string; outfitCheckId: string }) =>
      challengeService.submitEntry(challengeId, outfitCheckId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['challenge', 'my-submission', variables.challengeId] });
      queryClient.invalidateQueries({ queryKey: ['challenge', 'leaderboard', variables.challengeId] });
      queryClient.invalidateQueries({ queryKey: ['challenge', 'active'] });
      queryClient.invalidateQueries({ queryKey: ['challenges'] });
    },
  });
}

export function useVoteForSubmission() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ challengeId, submissionId }: { challengeId: string; submissionId: string }) =>
      challengeService.voteForSubmission(challengeId, submissionId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['challenge', 'leaderboard', variables.challengeId] });
    },
  });
}

// Wardrobe hooks
export function useWardrobeItems(params?: { category?: WardrobeCategory; source?: 'ai-detected' | 'manual' }) {
  const category = params?.category;
  return useQuery({
    queryKey: ['wardrobe', category ?? 'all', params?.source ?? 'all'],
    queryFn: () => wardrobeService.listItems(params),
  });
}

export function useWardrobeProgress() {
  return useQuery({
    queryKey: ['wardrobeProgress'],
    queryFn: () => wardrobeService.getProgress(),
    staleTime: 60_000,
  });
}

export function useWardrobeItemOutfits(id: string | null) {
  return useQuery({
    queryKey: ['wardrobeItemOutfits', id],
    queryFn: () => wardrobeService.getItemOutfits(id!),
    enabled: !!id,
  });
}

export function useAddWardrobeItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { name: string; category: WardrobeCategory; color?: string; imageUrl?: string }) =>
      wardrobeService.createItem(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wardrobe'] });
    },
  });
}

export function useUpdateWardrobeItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({
      id,
      data,
    }: {
      id: string;
      data: { name?: string; category?: WardrobeCategory; color?: string; imageUrl?: string | null };
    }) => wardrobeService.updateItem(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wardrobe'] });
    },
  });
}

export function useDeleteWardrobeItem() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wardrobeService.deleteItem(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wardrobe'] });
    },
  });
}

export function useLogWear() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => wardrobeService.logWear(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['wardrobe'] });
    },
  });
}

// Event Planning hooks
export function useEvents(status?: 'upcoming' | 'past') {
  return useQuery({
    queryKey: ['events', status ?? 'all'],
    queryFn: () => eventService.listEvents(status),
  });
}

export function useEvent(id: string | undefined) {
  return useQuery({
    queryKey: ['event', id],
    queryFn: () => eventService.getEvent(id!),
    enabled: !!id,
  });
}

export function useCreateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (data: { title: string; date: string; dressCode?: EventDressCode; type?: EventType; notes?: string }) =>
      eventService.createEvent(data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useUpdateEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: Parameters<typeof eventService.updateEvent>[1] }) =>
      eventService.updateEvent(id, data),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
      queryClient.invalidateQueries({ queryKey: ['event', variables.id] });
    },
  });
}

export function useDeleteEvent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: string) => eventService.deleteEvent(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useAddEventOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, outfitCheckId }: { eventId: string; outfitCheckId: string }) =>
      eventService.addOutfit(eventId, outfitCheckId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useRemoveEventOutfit() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ eventId, outfitCheckId }: { eventId: string; outfitCheckId: string }) =>
      eventService.removeOutfit(eventId, outfitCheckId),
    onSuccess: (_data, variables) => {
      queryClient.invalidateQueries({ queryKey: ['event', variables.eventId] });
      queryClient.invalidateQueries({ queryKey: ['events'] });
    },
  });
}

export function useCompareEventOutfits() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (eventId: string) => eventService.compareOutfits(eventId),
    onSuccess: (_data, eventId) => {
      queryClient.invalidateQueries({ queryKey: ['event', eventId] });
    },
  });
}

// Referral hooks
export function useReferralStats() {
  return useQuery({
    queryKey: ['referral', 'stats'],
    queryFn: () => referralService.getStats(),
  });
}

export function useClaimReferral() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (referralCode: string) => referralService.claimReferral(referralCode),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['referral'] });
    },
  });
}
