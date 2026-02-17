import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { api, outfitService, userService, socialService, notificationService, subscriptionService, comparisonService, expertReviewService, OutfitCheckInput } from '../services/api.service';

// Query keys
export const queryKeys = {
  user: ['user'],
  userStats: ['user', 'stats'],
  outfit: (id: string) => ['outfit', id],
  outfits: (filters?: any) => ['outfits', filters],
  communityFeed: (filters?: any) => ['community', 'feed', filters],
  communityFeedback: (outfitId: string) => ['community', 'feedback', outfitId],
  publicUser: (userId: string) => ['community', 'user', userId],
  followers: (username: string) => ['community', 'followers', username],
  following: (username: string) => ['community', 'following', username],
  leaderboard: (type: string) => ['community', 'leaderboard', type],
  notifications: (unreadOnly?: boolean) => ['notifications', unreadOnly],
  subscriptionStatus: ['subscription', 'status'],
  comparisonFeed: (params?: any) => ['comparisons', 'feed', params],
};

// User hooks
export function useUser() {
  return useQuery({
    queryKey: queryKeys.user,
    queryFn: () => userService.getProfile(),
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

// Temporarily disabled - endpoints not implemented yet
// export function useBadges() {
//   return useQuery({
//     queryKey: ['badges'] as const,
//     queryFn: async () => {
//       const response = await api.get('/api/user/badges');
//       return response.data;
//     },
//   });
// }

// export function useDailyGoals() {
//   return useQuery({
//     queryKey: ['dailyGoals'] as const,
//     queryFn: async () => {
//       const response = await api.get('/api/user/daily-goals');
//       return response.data;
//     },
//   });
// }

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
