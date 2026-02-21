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

export type ShareWith = 'private' | 'inner_circle' | 'public';

export interface OutfitCheckInput {
  imageUrl?: string;
  imageBase64?: string;
  occasions: string[];
  setting?: string;
  weather?: string;
  vibe?: string;
  specificConcerns?: string;
  timezone?: string;
  shareWith?: ShareWith;
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

  async reanalyzeOutfit(outfitId: string) {
    const response = await api.post<{ message: string }>(`/api/outfits/${outfitId}/reanalyze`);
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

  async clearHistory() {
    const response = await api.delete<{ success: boolean; deletedCount: number }>('/api/user/history');
    return response.data;
  },

  async deleteAccount() {
    const response = await api.delete<{ success: boolean }>('/api/user/account');
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

  // Inner Circle
  async getInnerCircle() {
    const response = await api.get<{
      members: Array<{ id: string; username: string | null; name: string | null; profileImageUrl: string | null; addedAt: string }>;
    }>('/api/social/inner-circle');
    return response.data;
  },
  async addToInnerCircle(username: string) {
    const response = await api.post<{ success: boolean; added: string }>(`/api/social/users/${username}/inner-circle`);
    return response.data;
  },
  async removeFromInnerCircle(username: string) {
    const response = await api.delete<{ success: boolean; removed: string }>(`/api/social/users/${username}/inner-circle`);
    return response.data;
  },
  async getInnerCircleStatus(username: string) {
    const response = await api.get<{ isInCircle: boolean }>(`/api/social/users/${username}/inner-circle/status`);
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

// Comparison Service
export interface ComparisonPost {
  id: string;
  imageAUrl?: string;
  imageAData?: string;
  imageBUrl?: string;
  imageBData?: string;
  question?: string;
  occasions: string[];
  votesA: number;
  votesB: number;
  myVote: 'A' | 'B' | null;
  createdAt: string;
  user: { id: string; username: string | null; name: string | null; profileImageUrl?: string };
}

export const comparisonService = {
  async createPost(data: {
    imageAData?: string;
    imageAUrl?: string;
    imageBData?: string;
    imageBUrl?: string;
    question?: string;
    occasions: string[];
  }) {
    const response = await api.post<ComparisonPost>('/api/comparisons', data);
    return response.data;
  },

  async getFeed(params: { limit?: number; offset?: number } = {}) {
    const query = new URLSearchParams();
    if (params.limit) query.set('limit', String(params.limit));
    if (params.offset) query.set('offset', String(params.offset));
    const response = await api.get<{ posts: ComparisonPost[]; hasMore: boolean }>(
      `/api/comparisons/feed?${query}`
    );
    return response.data;
  },

  async vote(postId: string, choice: 'A' | 'B') {
    const response = await api.post<{ success: boolean; votesA: number; votesB: number; myVote: string }>(
      `/api/comparisons/${postId}/vote`,
      { choice }
    );
    return response.data;
  },

  async deletePost(postId: string) {
    const response = await api.delete<{ success: boolean }>(`/api/comparisons/${postId}`);
    return response.data;
  },
};

// Expert Review Service
export interface StylistProfile {
  id: string;
  userId: string;
  bio: string | null;
  specialties: string[];
  instagramUrl: string | null;
  verified: boolean;
  rating: number;
  reviewCount: number;
  createdAt: string;
  user: { id: string; username: string | null; name: string | null; profileImageUrl: string | null };
}

export interface ExpertReview {
  id: string;
  outfitCheckId: string;
  userId: string;
  stylistId: string;
  status: 'pending' | 'in_progress' | 'completed' | 'cancelled';
  score: number | null;
  feedback: string | null;
  completedAt: string | null;
  requestedAt: string;
  stylist: StylistProfile;
  outfitCheck?: {
    id: string;
    thumbnailUrl: string | null;
    thumbnailData: string | null;
    occasions: string[];
  };
}

export const expertReviewService = {
  async requestReview(outfitCheckId: string, stylistId?: string) {
    const response = await api.post<{ review: ExpertReview; reviewsUsedThisMonth: number }>(
      '/api/expert-reviews',
      { outfitCheckId, stylistId }
    );
    return response.data;
  },

  async getMyReviews() {
    const response = await api.get<{
      reviews: ExpertReview[];
      usedThisMonth: number;
      monthlyLimit: number;
    }>('/api/expert-reviews/my-requests');
    return response.data;
  },

  async getOutfitReview(outfitId: string) {
    const response = await api.get<{ review: ExpertReview | null }>(
      `/api/expert-reviews/outfit/${outfitId}`
    );
    return response.data;
  },

  async cancelReview(reviewId: string) {
    const response = await api.delete<{ message: string }>(`/api/expert-reviews/${reviewId}`);
    return response.data;
  },

  async getStylists(params?: { specialty?: string; limit?: number; offset?: number }) {
    const response = await api.get<{ stylists: StylistProfile[] }>('/api/stylists', { params });
    return response.data;
  },

  async applyStylist(data: { bio: string; specialties: string[]; instagramUrl?: string }) {
    const response = await api.post<{ stylist: StylistProfile }>('/api/stylists/apply', data);
    return response.data;
  },

  async getMyStylistProfile() {
    const response = await api.get<{ stylist: StylistProfile }>('/api/stylists/me');
    return response.data;
  },

  async updateMyStylistProfile(data: {
    bio?: string;
    specialties?: string[];
    instagramUrl?: string;
  }) {
    const response = await api.put<{ stylist: StylistProfile }>('/api/stylists/me', data);
    return response.data;
  },

  async getStylistQueue() {
    const response = await api.get<{ reviews: ExpertReview[] }>('/api/expert-reviews/my-queue');
    return response.data;
  },

  async submitReview(reviewId: string, data: { score: number; feedback: string }) {
    const response = await api.post<{ review: ExpertReview }>(
      `/api/expert-reviews/${reviewId}/submit`,
      data
    );
    return response.data;
  },
};

// Challenges Service
export interface Challenge {
  id: string;
  title: string;
  description: string;
  theme: string;
  prize: string | null;
  status: 'upcoming' | 'active' | 'ended';
  startsAt: string;
  endsAt: string;
  submissionCount: number;
  createdAt: string;
}

export interface ChallengeSubmission {
  id: string;
  challengeId: string;
  outfitCheckId: string;
  userId: string;
  votes: number;
  createdAt: string;
  user: {
    id: string;
    username: string | null;
    name: string | null;
    profileImageUrl: string | null;
  };
  outfitCheck: {
    id: string;
    thumbnailUrl: string | null;
    thumbnailData: string | null;
    aiScore: number | null;
  };
}

export const challengeService = {
  async listChallenges(status: 'active' | 'upcoming' | 'ended' = 'active') {
    const response = await api.get<{ challenges: Challenge[] }>('/api/challenges', {
      params: { status },
    });
    return response.data;
  },

  async getActiveChallenge() {
    const response = await api.get<{ challenge: Challenge | null }>('/api/challenges/active');
    return response.data;
  },

  async getChallenge(id: string) {
    const response = await api.get<{ challenge: Challenge }>(`/api/challenges/${id}`);
    return response.data;
  },

  async getLeaderboard(challengeId: string, params?: { limit?: number; offset?: number }) {
    const response = await api.get<{
      submissions: ChallengeSubmission[];
      total: number;
    }>(`/api/challenges/${challengeId}/leaderboard`, { params });
    return response.data;
  },

  async getMySubmission(challengeId: string) {
    const response = await api.get<{ submission: ChallengeSubmission | null }>(
      `/api/challenges/${challengeId}/my-submission`
    );
    return response.data;
  },

  async submitEntry(challengeId: string, outfitCheckId: string) {
    const response = await api.post<{ submission: ChallengeSubmission }>(
      `/api/challenges/${challengeId}/submit`,
      { outfitCheckId }
    );
    return response.data;
  },

  async voteForSubmission(challengeId: string, submissionId: string) {
    const response = await api.post<{ votes: number }>(
      `/api/challenges/${challengeId}/submissions/${submissionId}/vote`
    );
    return response.data;
  },
};

// Wardrobe Service
export type WardrobeCategory = 'tops' | 'bottoms' | 'shoes' | 'accessories' | 'outerwear';

export interface WardrobeItem {
  id: string;
  userId: string;
  name: string;
  category: WardrobeCategory;
  color: string | null;
  imageUrl: string | null;
  timesWorn: number;
  lastWorn: string | null;
  createdAt: string;
  updatedAt: string;
}

export const wardrobeService = {
  async listItems(category?: WardrobeCategory) {
    const response = await api.get<{ items: WardrobeItem[] }>('/api/wardrobe', {
      params: category ? { category } : undefined,
    });
    return response.data;
  },

  async createItem(data: { name: string; category: WardrobeCategory; color?: string; imageUrl?: string }) {
    const response = await api.post<{ item: WardrobeItem }>('/api/wardrobe', data);
    return response.data;
  },

  async updateItem(
    id: string,
    data: { name?: string; category?: WardrobeCategory; color?: string; imageUrl?: string | null }
  ) {
    const response = await api.put<{ item: WardrobeItem }>(`/api/wardrobe/${id}`, data);
    return response.data;
  },

  async deleteItem(id: string) {
    const response = await api.delete<{ success: boolean }>(`/api/wardrobe/${id}`);
    return response.data;
  },

  async logWear(id: string) {
    const response = await api.post<{ item: WardrobeItem }>(`/api/wardrobe/${id}/wear`);
    return response.data;
  },
};

// Event Planning Service
export type EventDressCode = 'casual' | 'smart_casual' | 'business_casual' | 'formal' | 'black_tie';
export type EventType = 'wedding' | 'job_interview' | 'date_night' | 'conference' | 'party' | 'vacation' | 'other';

export interface EventOutfitOption {
  id: string;
  eventId: string;
  outfitCheckId: string;
  userId: string;
  addedAt: string;
  outfitCheck: {
    id: string;
    thumbnailUrl: string | null;
    thumbnailData: string | null;
    aiScore: number | null;
    aiFeedback: any;
    occasions: string[];
    setting: string | null;
    weather: string | null;
    vibe: string | null;
    createdAt: string;
  };
}

export interface Event {
  id: string;
  userId: string;
  title: string;
  date: string;
  dressCode: EventDressCode | null;
  type: EventType | null;
  notes: string | null;
  status: 'upcoming' | 'past';
  compareResult: CompareResult | null;
  compareRunAt: string | null;
  outfitCount?: number;
  outfitOptions?: EventOutfitOption[];
  createdAt: string;
  updatedAt: string;
}

export interface CompareRanking {
  outfitId: string;
  rank: number;
  score: number;
  notes: string;
}

export interface CompareResult {
  winnerId: string;
  winnerReason: string;
  rankings: CompareRanking[];
  stylingTip: string;
  summary: string;
}

export const eventService = {
  async listEvents(status?: 'upcoming' | 'past') {
    const response = await api.get<{ events: Event[] }>('/api/events', {
      params: status ? { status } : undefined,
    });
    return response.data;
  },

  async getEvent(id: string) {
    const response = await api.get<{ event: Event }>(`/api/events/${id}`);
    return response.data;
  },

  async createEvent(data: {
    title: string;
    date: string;
    dressCode?: EventDressCode;
    type?: EventType;
    notes?: string;
  }) {
    const response = await api.post<{ event: Event }>('/api/events', data);
    return response.data;
  },

  async updateEvent(
    id: string,
    data: {
      title?: string;
      date?: string;
      dressCode?: EventDressCode | null;
      type?: EventType | null;
      notes?: string | null;
      status?: 'upcoming' | 'past';
    }
  ) {
    const response = await api.put<{ event: Event }>(`/api/events/${id}`, data);
    return response.data;
  },

  async deleteEvent(id: string) {
    const response = await api.delete<{ success: boolean }>(`/api/events/${id}`);
    return response.data;
  },

  async addOutfit(eventId: string, outfitCheckId: string) {
    const response = await api.post<{ eventOutfit: EventOutfitOption }>(
      `/api/events/${eventId}/outfits`,
      { outfitCheckId }
    );
    return response.data;
  },

  async removeOutfit(eventId: string, outfitCheckId: string) {
    const response = await api.delete<{ success: boolean }>(
      `/api/events/${eventId}/outfits/${outfitCheckId}`
    );
    return response.data;
  },

  async compareOutfits(eventId: string) {
    const response = await api.post<{ result: CompareResult; cached: boolean }>(
      `/api/events/${eventId}/compare`
    );
    return response.data;
  },
};
