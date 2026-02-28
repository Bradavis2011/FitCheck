import { z } from 'zod';

export const FollowUpQuestionSchema = z.object({
  question: z.string().min(1, 'Question is required').max(500),
});

export const RateFeedbackSchema = z.object({
  helpful: z.boolean().optional(),
  rating: z.number().int().min(1).max(5).optional(),
});

export const RespondToFollowUpSchema = z.object({
  response: z.string().min(1, 'response is required').max(500),
});

export const ClaimReferralSchema = z.object({
  referralCode: z.string().min(1, 'referralCode is required'),
});

export const SyncSubscriptionSchema = z.object({
  entitlementIds: z.array(z.string()),
  productId: z.string().optional(),
  expiresAt: z.string().optional(),
});

export const GetNotificationsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
  unreadOnly: z.enum(['true', 'false']).default('false'),
});

export const SearchUsersQuerySchema = z.object({
  q: z.string().min(2, 'Search query must be at least 2 characters').max(100),
});

export const CommunityFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
  filter: z.enum(['recent', 'popular', 'top-rated', 'inner_circle']).default('recent'),
});

export const LeaderboardQuerySchema = z.object({
  type: z.enum(['top-rated', 'most-active', 'most-helpful', 'most-popular', 'weekly']).default('top-rated'),
  limit: z.coerce.number().int().min(1).max(100).default(50),
});

export const ListOutfitChecksQuerySchema = z.object({
  occasion: z.string().optional(),
  isFavorite: z.enum(['true', 'false']).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});

export const ComparisonFeedQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
  offset: z.coerce.number().int().min(0).default(0),
});
