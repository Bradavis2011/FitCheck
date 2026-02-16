import { api, setAuthToken } from '../lib/api';

// Re-export api for use in other files
export { api };

// Types
export interface StylePreferences {
  styles?: string[];
  priorities?: string[];
  bodyConcerns?: string[];
}

export interface PrivacySettings {
  blurFaceDefault: boolean;
  visibility: 'all' | 'followers' | 'trusted';
  autoDelete: 'never' | '24h' | '7d' | '30d';
}

export interface User {
  id: string;
  email: string;
  name?: string;
  username?: string;
  bio?: string;
  isPublic?: boolean;
  profileImageUrl?: string;
  stylePreferences?: StylePreferences;
  privacySettings?: PrivacySettings;
  bodyType?: string;
  colorSeason?: string;
  tier: 'free' | 'plus' | 'pro';
  subscriptionExpiresAt?: string;
  dailyChecksUsed: number;
  createdAt: string;
}

export interface StyleDNA {
  dominantColors: string[];
  colorHarmony: string | null;
  colorCount: number | null;
  formalityLevel: number | null;
  styleArchetypes: string[];
  silhouetteType: string | null;
  garments: string[];
  patterns: string[];
  textures: string[];
  colorScore: number | null;
  proportionScore: number | null;
  fitScore: number | null;
  coherenceScore: number | null;
}

export interface OutfitFeedback {
  overallScore: number;
  summary: string;
  whatsWorking: Array<{
    point: string;
    detail: string;
  }>;
  consider: Array<{
    point: string;
    detail: string;
  }>;
  quickFixes: Array<{
    suggestion: string;
    impact: string;
  }>;
  occasionMatch: {
    score: number;
    notes: string;
  };
  styleDNA?: StyleDNA;
}

export interface OutfitCheck {
  id: string;
  userId: string;
  imageUrl?: string;
  imageData?: string;
  thumbnailUrl?: string;
  thumbnailData?: string;
  occasions: string[];
  setting?: string;
  weather?: string;
  vibe?: string;
  specificConcerns?: string;
  aiFeedback?: OutfitFeedback;
  aiScore?: number;
  aiProcessedAt?: string;
  feedbackHelpful?: boolean;
  feedbackRating?: number;
  communityAvgScore?: number;
  communityScoreCount?: number;
  isFavorite: boolean;
  isPublic: boolean;
  isDeleted: boolean;
  blurFace?: boolean;
  visibility?: string;
  expiresAt?: string;
  createdAt: string;
  followUps?: FollowUp[];
}

export interface FollowUp {
  id: string;
  outfitCheckId: string;
  userQuestion: string;
  aiResponse?: string;
  createdAt: string;
}

export interface OutfitCheckInput {
  imageUrl?: string;
  imageBase64?: string;
  occasions: string[];
  setting?: string;
  weather?: string;
  vibe?: string;
  specificConcerns?: string;
}

export interface UserStats {
  userId: string;
  totalFeedbackGiven: number;
  totalHelpfulVotes: number;
  currentStreak: number;
  longestStreak: number;
  points: number;
  level: number;
  xpToNextLevel: number;
  totalOutfits: number;
  totalFavorites: number;
  dailyChecksUsed: number;
  dailyChecksLimit: number;
  dailyChecksRemaining: number;
}

// Auth Service
export const authService = {
  async register(email: string, password: string, name?: string) {
    const response = await api.post<{ user: User; token: string }>('/api/auth/register', {
      email,
      password,
      name,
    });
    setAuthToken(response.data.token);
    return response.data;
  },

  async login(email: string, password: string) {
    const response = await api.post<{ user: User; token: string }>('/api/auth/login', {
      email,
      password,
    });
    setAuthToken(response.data.token);
    return response.data;
  },

  logout() {
    setAuthToken(null);
  },
};

// Outfit Service
export const outfitService = {
  async submitCheck(input: OutfitCheckInput) {
    const response = await api.post<{ id: string; message: string }>('/api/outfits/check', input);
    return response.data;
  },

  async getOutfit(id: string) {
    const response = await api.get<OutfitCheck>(`/api/outfits/${id}`);
    return response.data;
  },

  async listOutfits(params?: {
    occasion?: string;
    isFavorite?: boolean;
    limit?: number;
    offset?: number;
  }) {
    const response = await api.get<{
      outfits: OutfitCheck[];
      total: number;
      hasMore: boolean;
    }>('/api/outfits', { params });
    return response.data;
  },

  async submitFollowUp(outfitId: string, question: string) {
    const response = await api.post<{ question: string; answer: string }>(
      `/api/outfits/${outfitId}/followup`,
      { question }
    );
    return response.data;
  },

  async rateFeedback(outfitId: string, helpful: boolean, rating?: number) {
    const response = await api.put<{ success: boolean }>(`/api/outfits/${outfitId}/rate`, {
      helpful,
      rating,
    });
    return response.data;
  },

  async toggleFavorite(outfitId: string) {
    const response = await api.put<{ isFavorite: boolean }>(
      `/api/outfits/${outfitId}/favorite`
    );
    return response.data;
  },

  async togglePublic(outfitId: string) {
    const response = await api.put<{ isPublic: boolean }>(
      `/api/outfits/${outfitId}/public`
    );
    return response.data;
  },

  async deleteOutfit(outfitId: string) {
    const response = await api.delete<{ success: boolean }>(`/api/outfits/${outfitId}`);
    return response.data;
  },
};

// User Service
export const userService = {
  async getProfile() {
    const response = await api.get<User>('/api/user/profile');
    return response.data;
  },

  async updateProfile(data: Partial<User>) {
    const response = await api.put<User>('/api/user/profile', data);
    return response.data;
  },

  async getStats() {
    const response = await api.get<UserStats>('/api/user/stats');
    return response.data;
  },
};

// Social/Community Service
export interface PublicUser {
  id: string;
  username: string;
  name?: string;
  profileImageUrl?: string;
}

export interface PublicOutfit {
  id: string;
  imageUrl?: string;
  thumbnailUrl?: string;
  thumbnailData?: string;
  occasions: string[];
  aiScore: number;
  createdAt: string;
  user: PublicUser;
  _count: {
    communityFeedback: number;
  };
}

export interface CommunityFeedback {
  id: string;
  outfitId: string;
  userId: string;
  score: number;
  comment: string;
  createdAt: string;
  user: PublicUser;
  gamification?: {
    pointsAwarded: number;
    totalPoints: number;
    level: number;
    leveledUp: boolean;
    oldLevel?: number;
    newBadges?: string[];
  };
}

export const socialService = {
  async getCommunityFeed(params?: {
    filter?: 'recent' | 'popular' | 'top-rated';
    limit?: number;
    offset?: number;
  }) {
    const response = await api.get<{
      outfits: PublicOutfit[];
      total: number;
      hasMore: boolean;
    }>('/api/social/community/feed', { params });
    return response.data;
  },

  async getPublicOutfit(outfitId: string) {
    const response = await api.get<OutfitCheck>(`/api/social/outfits/${outfitId}`);
    return response.data;
  },

  async submitCommunityFeedback(outfitId: string, score: number, comment: string) {
    const response = await api.post<CommunityFeedback>('/api/social/community/feedback', {
      outfitId,
      score,
      comment,
    });
    return response.data;
  },

  async getOutfitFeedback(outfitId: string) {
    const response = await api.get<{ feedback: CommunityFeedback[] }>(
      `/api/social/outfits/${outfitId}/feedback`
    );
    return response.data;
  },

  async getUserProfile(userId: string) {
    const response = await api.get<{
      id: string;
      username: string;
      name?: string;
      profileImageUrl?: string;
      bio?: string;
      createdAt: string;
      outfitChecks: PublicOutfit[];
      outfitCount: number;
    }>(`/api/social/users/${userId}/profile`);
    return response.data;
  },

  async getUserProfileByUsername(username: string) {
    const response = await api.get<{
      id: string;
      username: string;
      name?: string;
      profileImageUrl?: string;
      bio?: string;
      createdAt: string;
      outfitChecks: PublicOutfit[];
      outfitCount: number;
    }>(`/api/social/users/username/${username}`);
    return response.data;
  },

  async searchUsers(query: string) {
    const response = await api.get<{ users: PublicUser[] }>('/api/social/users/search', {
      params: { q: query },
    });
    return response.data;
  },

  async reportContent(
    targetType: 'outfit' | 'user',
    targetId: string,
    reason: 'inappropriate' | 'spam' | 'other',
    details?: string
  ) {
    const response = await api.post<{ success: boolean; reportId: string }>(
      '/api/social/report',
      {
        targetType,
        targetId,
        reason,
        details,
      }
    );
    return response.data;
  },

  async blockUser(username: string) {
    const response = await api.post<{ success: boolean; blocked: string }>(
      `/api/social/users/${username}/block`
    );
    return response.data;
  },

  async unblockUser(username: string) {
    const response = await api.delete<{ success: boolean; unblocked: string }>(
      `/api/social/users/${username}/block`
    );
    return response.data;
  },

  async getBlockedUsers() {
    const response = await api.get<{
      blockedUsers: Array<{
        id: string;
        user: PublicUser;
        blockedAt: string;
      }>;
    }>('/api/social/blocked-users');
    return response.data;
  },

  async followUser(username: string) {
    const response = await api.post<{ success: boolean; following: string }>(
      `/api/social/users/${username}/follow`
    );
    return response.data;
  },

  async unfollowUser(username: string) {
    const response = await api.delete<{ success: boolean; unfollowed: string }>(
      `/api/social/users/${username}/follow`
    );
    return response.data;
  },

  async getFollowers(username: string) {
    const response = await api.get<{
      followers: Array<PublicUser & { followedAt: string }>;
    }>(`/api/social/users/${username}/followers`);
    return response.data;
  },

  async getFollowing(username: string) {
    const response = await api.get<{
      following: Array<PublicUser & { followedAt: string }>;
    }>(`/api/social/users/${username}/following`);
    return response.data;
  },

  async getLeaderboard(type: string, limit: number = 50) {
    const response = await api.get<{
      leaderboard: Array<{
        userId: string;
        username: string | null;
        name: string | null;
        rank: number;
        score: number;
      }>;
    }>(`/api/social/leaderboard?type=${type}&limit=${limit}`);
    return response.data;
  },
};

// Notification service
export const notificationService = {
  async getNotifications(unreadOnly: boolean = false) {
    const response = await api.get<{
      notifications: Array<{
        id: string;
        type: string;
        title: string;
        body: string;
        linkType: string | null;
        linkId: string | null;
        isRead: boolean;
        createdAt: string;
      }>;
      unreadCount: number;
    }>(`/api/notifications?unreadOnly=${unreadOnly}`);
    return response.data;
  },

  async markAsRead(notificationId: string) {
    const response = await api.put<{ success: boolean }>(
      `/api/notifications/${notificationId}/read`
    );
    return response.data;
  },

  async markAllAsRead() {
    const response = await api.put<{ success: boolean }>('/api/notifications/read-all');
    return response.data;
  },
};

// Subscription Service
export const subscriptionService = {
  async syncSubscription(data: {
    entitlementIds: string[];
    productId: string | null;
    expiresAt: number | null;
  }) {
    const response = await api.post<{ tier: string; expiresAt: string | null }>(
      '/api/subscription/sync',
      data
    );
    return response.data;
  },

  async getSubscriptionStatus() {
    const response = await api.get<{
      tier: string;
      limits: {
        dailyChecks: number;
        followUpsPerCheck: number;
        historyDays: number;
        hasAds: boolean;
        hasPriorityProcessing: boolean;
      };
    }>('/api/subscription/status');
    return response.data;
  },
};
