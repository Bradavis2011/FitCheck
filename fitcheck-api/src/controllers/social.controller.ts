// @ts-nocheck
import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { createNotification } from './notification.controller.js';
import * as gamificationService from '../services/gamification.service.js';
import { trackServerEvent } from '../lib/posthog.js';

// Minimal profanity check — avoids bad-words CJS/ESM incompatibility
const BLOCKED_WORDS = ['fuck', 'shit', 'cunt', 'nigger', 'faggot', 'bitch', 'asshole', 'dick', 'pussy', 'cock'];
const profanityFilter = {
  isProfane: (text: string) => {
    const lower = text.toLowerCase();
    return BLOCKED_WORDS.some((w) => lower.includes(w));
  },
};

// Validation schemas
const ReportSchema = z.object({
  targetType: z.enum(['outfit', 'user']),
  targetId: z.string(),
  reason: z.enum(['inappropriate', 'spam', 'other']),
  details: z.string().max(500).optional(),
});

// Search for public users
export async function searchUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const { q } = req.query;

    if (!q || typeof q !== 'string' || q.trim().length < 2 || q.trim().length > 100) {
      throw new AppError(400, 'Search query must be between 2 and 100 characters');
    }

    const users = await prisma.user.findMany({
      where: {
        isPublic: true,
        OR: [
          { username: { contains: q, mode: 'insensitive' } },
          { name: { contains: q, mode: 'insensitive' } },
        ],
      },
      select: {
        id: true,
        username: true,
        name: true,
        profileImageUrl: true,
        bio: true,
      },
      take: 20,
    });

    res.json({ users });
  } catch (error) {
    throw error;
  }
}

// Get public user profile by ID
export async function getUserProfile(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const user = await prisma.user.findUnique({
      where: { id, isPublic: true },
      select: {
        id: true,
        username: true,
        name: true,
        profileImageUrl: true,
        bio: true,
        createdAt: true,
        outfitChecks: {
          where: { isPublic: true, isDeleted: false },
          select: {
            id: true,
            thumbnailUrl: true,
            thumbnailData: true,
            imageUrl: true,
            occasions: true,
            aiScore: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found or profile is private');
    }

    res.json({
      ...user,
      outfitCount: user.outfitChecks.length,
    });
  } catch (error) {
    throw error;
  }
}

// Get public user profile by username
export async function getUserProfileByUsername(req: AuthenticatedRequest, res: Response) {
  try {
    const { username } = req.params;

    const user = await prisma.user.findFirst({
      where: {
        username,
        isPublic: true
      },
      select: {
        id: true,
        username: true,
        name: true,
        profileImageUrl: true,
        bio: true,
        createdAt: true,
        outfitChecks: {
          where: { isPublic: true, isDeleted: false },
          select: {
            id: true,
            thumbnailUrl: true,
            thumbnailData: true,
            imageUrl: true,
            occasions: true,
            aiScore: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'desc' },
          take: 50,
        },
      },
    });

    if (!user) {
      throw new AppError(404, 'User not found or profile is private');
    }

    res.json({
      ...user,
      outfitCount: user.outfitChecks.length,
    });
  } catch (error) {
    throw error;
  }
}

// Get single public outfit with full details
export async function getPublicOutfit(req: AuthenticatedRequest, res: Response) {
  try {
    const { id } = req.params;

    const outfit = await prisma.outfitCheck.findFirst({
      where: {
        id,
        isPublic: true,
        isDeleted: false,
      },
      select: {
        id: true,
        userId: true,
        thumbnailUrl: true,
        thumbnailData: true,
        imageData: true,
        imageUrl: true,
        occasions: true,
        setting: true,
        weather: true,
        vibe: true,
        specificConcerns: true,
        aiFeedback: true,
        aiScore: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
    });

    if (!outfit) {
      throw new AppError(404, 'Outfit not found or not public');
    }

    res.json(outfit);
  } catch (error) {
    throw error;
  }
}

// Get community feed (public outfits)
export async function getCommunityFeed(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { limit: limitParam = '20', offset = '0', filter = 'recent' } = req.query;
    const limit = String(Math.min(parseInt(limitParam as string) || 20, 100));

    // Get blocked user IDs
    const blockedUsers = await prisma.blockedUser.findMany({
      where: { userId },
      select: { blockedId: true },
    });
    const blockedUserIds = blockedUsers.map((b) => b.blockedId);

    // Inner circle feed: outfits shared specifically to the user's circle
    if (filter === 'inner_circle') {
      // Find users whose inner circle includes the current user
      const circleOwners = await prisma.innerCircleMember.findMany({
        where: { memberId: userId },
        select: { userId: true },
      });
      const ownerIds = circleOwners.map((c) => c.userId).filter((id) => !blockedUserIds.includes(id));

      const outfits = await prisma.outfitCheck.findMany({
        where: {
          isPublic: true,
          isDeleted: false,
          visibility: 'inner_circle',
          userId: { in: ownerIds },
        },
        select: {
          id: true, thumbnailUrl: true, thumbnailData: true, imageUrl: true,
          occasions: true, aiScore: true, createdAt: true,
          user: { select: { id: true, username: true, name: true, profileImageUrl: true } },
          _count: { select: { communityFeedback: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: parseInt(limit as string),
        skip: parseInt(offset as string),
      });

      const total = await prisma.outfitCheck.count({
        where: { isPublic: true, isDeleted: false, visibility: 'inner_circle', userId: { in: ownerIds } },
      });

      return res.json({ outfits, total, hasMore: total > parseInt(offset as string) + outfits.length });
    }

    // Determine sort order based on filter
    let orderBy: any = { createdAt: 'desc' }; // Default: recent

    if (filter === 'popular') {
      // Sort by feedback count (most feedback)
      orderBy = { communityFeedback: { _count: 'desc' } };
    } else if (filter === 'top-rated') {
      // Sort by AI score (highest rated)
      orderBy = { aiScore: 'desc' };
    }

    // Resolve visibility: get users the current user follows (for 'followers' posts)
    // and trusted reviewers (for 'trusted' posts — users with >= 5 helpful votes)
    const [followingRows, trustedRows] = await Promise.all([
      prisma.follow.findMany({
        where: { followerId: userId },
        select: { followingId: true },
      }),
      prisma.userStats.findMany({
        where: { totalHelpfulVotes: { gte: 5 } },
        select: { userId: true },
      }),
    ]);
    const followingIds = followingRows.map((f: any) => f.followingId);
    const trustedIds = trustedRows.map((r: any) => r.userId);

    // Build visibility OR clause: 'all' is visible to everyone;
    // 'followers' only to followers; 'trusted' only to active reviewers
    const visibilityFilter: any[] = [
      { visibility: 'all' },
      ...(followingIds.length > 0 ? [{ visibility: 'followers', userId: { in: followingIds } }] : []),
      ...(trustedIds.length > 0 ? [{ visibility: 'trusted', userId: { in: trustedIds } }] : []),
    ];

    const feedWhere: any = {
      isPublic: true,
      isDeleted: false,
      OR: visibilityFilter,
      user: { isPublic: true },
      NOT: { userId: { in: blockedUserIds } },
    };

    const outfits = await prisma.outfitCheck.findMany({
      where: feedWhere,
      select: {
        id: true,
        thumbnailUrl: true,
        thumbnailData: true,
        imageUrl: true,
        occasions: true,
        aiScore: true,
        createdAt: true,
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
        _count: {
          select: {
            communityFeedback: true,
          },
        },
      },
      orderBy,
      take: parseInt(limit as string),
      skip: parseInt(offset as string),
    });

    const total = await prisma.outfitCheck.count({ where: feedWhere });

    res.json({
      outfits,
      total,
      hasMore: total > parseInt(offset as string) + outfits.length,
    });
  } catch (error) {
    throw error;
  }
}

// Submit community feedback
const FeedbackSchema = z.object({
  outfitId: z.string(),
  score: z.number().int().min(1).max(10),
  comment: z.string().min(1).max(500),
});

export async function submitCommunityFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    // Tier check: Only Plus/Pro users can submit community feedback
    if (!req.user || req.user.tier === 'free') {
      throw new AppError(403, 'Community feedback requires a Plus or Pro subscription.');
    }

    const data = FeedbackSchema.parse(req.body);

    // Moderate comment text
    if (profanityFilter.isProfane(data.comment)) {
      throw new AppError(400, 'Your comment contains prohibited content. Please revise and resubmit.');
    }

    // Verify outfit is public
    const outfit = await prisma.outfitCheck.findFirst({
      where: {
        id: data.outfitId,
        isPublic: true,
        isDeleted: false,
      },
      include: {
        user: true,
      },
    });

    if (!outfit) {
      throw new AppError(404, 'Outfit not found or not public');
    }

    // If inner_circle outfit, verify the feedback author is in the owner's inner circle
    if (outfit.visibility === 'inner_circle') {
      const isMember = await prisma.innerCircleMember.findUnique({
        where: { userId_memberId: { userId: outfit.userId, memberId: userId } },
      });
      if (!isMember) {
        throw new AppError(403, 'This outfit is only visible to inner circle members');
      }
    }

    // Prevent feedback on own outfits
    if (outfit.userId === userId) {
      throw new AppError(400, 'Cannot give feedback on your own outfit');
    }

    // Check if outfit owner has blocked the feedback author
    const isBlocked = await prisma.blockedUser.findFirst({
      where: {
        userId: outfit.userId,
        blockedId: userId,
      },
    });

    if (isBlocked) {
      throw new AppError(403, 'You are blocked from interacting with this user');
    }

    // Create or update feedback
    const feedback = await prisma.communityFeedback.upsert({
      where: {
        outfitId_userId: {
          outfitId: data.outfitId,
          userId,
        },
      },
      create: {
        outfitId: data.outfitId,
        userId,
        score: data.score,
        comment: data.comment,
      },
      update: {
        score: data.score,
        comment: data.comment,
      },
    });

    // Update cached community score after feedback submission
    const agg = await prisma.communityFeedback.aggregate({
      where: { outfitId: data.outfitId },
      _avg: { score: true },
      _count: { score: true },
    });
    await prisma.outfitCheck.update({
      where: { id: data.outfitId },
      data: {
        communityAvgScore: agg._avg.score,
        communityScoreCount: agg._count.score,
      },
    });

    // Get feedbacker info for notification
    const feedbacker = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, name: true },
    });

    // Create notification for the outfit owner
    await createNotification({
      userId: outfit.userId,
      type: 'feedback',
      title: 'New Outfit Feedback',
      body: `${feedbacker?.username || feedbacker?.name || 'Someone'} gave feedback on your outfit (${data.score}/10)`,
      linkType: 'outfit',
      linkId: data.outfitId,
    });

    trackServerEvent(userId, 'community_feedback_given', { outfitId: data.outfitId });

    // Award points for giving feedback (gamification)
    const isFirstResponder = agg._count.score === 1; // This is the first feedback
    const pointsResult = await gamificationService.awardFeedbackPoints(userId, isFirstResponder);

    // Update streak
    await gamificationService.updateStreak(userId);

    // Increment totalFeedbackGiven
    await prisma.userStats.upsert({
      where: { userId },
      create: { userId, totalFeedbackGiven: 1 },
      update: { totalFeedbackGiven: { increment: 1 } },
    });

    res.json({
      feedback,
      gamification: {
        pointsAwarded: pointsResult.pointsAwarded,
        totalPoints: pointsResult.totalPoints,
        level: pointsResult.level,
        leveledUp: pointsResult.leveledUp,
        newBadges: pointsResult.newBadges,
      },
    });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid feedback data');
    }
    throw error;
  }
}

// Get community feedback for an outfit
export async function getOutfitFeedback(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { id } = req.params;

    // Get blocked user IDs
    const blockedUsers = await prisma.blockedUser.findMany({
      where: { userId },
      select: { blockedId: true },
    });
    const blockedUserIds = blockedUsers.map((b) => b.blockedId);

    // Verify outfit is public
    const outfit = await prisma.outfitCheck.findFirst({
      where: {
        id,
        isPublic: true,
        isDeleted: false,
      },
    });

    if (!outfit) {
      throw new AppError(404, 'Outfit not found or not public');
    }

    const feedback = await prisma.communityFeedback.findMany({
      where: {
        outfitId: id,
        NOT: { userId: { in: blockedUserIds } },
      },
      include: {
        user: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({ feedback });
  } catch (error) {
    throw error;
  }
}

// Get leaderboard
export async function getLeaderboard(req: AuthenticatedRequest, res: Response) {
  try {
    const { type = 'top-rated', limit = '50' } = req.query;
    const limitNum = Math.min(parseInt(limit as string) || 50, 100);

    let leaderboard: any[] = [];

    switch (type) {
      case 'top-rated': {
        // Aggregate avg score at DB level (min 5 public outfits)
        const grouped = await prisma.outfitCheck.groupBy({
          by: ['userId'],
          where: { isPublic: true, isDeleted: false, aiScore: { not: null } },
          _avg: { aiScore: true },
          _count: { _all: true },
          having: { aiScore: { _count: { gte: 5 } } },
          orderBy: { _avg: { aiScore: 'desc' } },
          take: limitNum,
        });

        const userIds = grouped.map((g: any) => g.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds }, isPublic: true },
          select: { id: true, username: true, name: true, profileImageUrl: true },
        });
        const userMap = new Map(users.map((u: any) => [u.id, u]));

        leaderboard = grouped
          .filter((g: any) => userMap.has(g.userId))
          .map((g: any, index: number) => ({
            userId: g.userId,
            ...userMap.get(g.userId),
            score: g._avg.aiScore || 0,
            outfitCount: g._count._all,
            rank: index + 1,
          }));
        break;
      }

      case 'most-helpful': {
        // Already efficient — DB-level count
        const users = await prisma.user.findMany({
          where: { isPublic: true },
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
            _count: {
              select: {
                communityFeedbackGiven: true,
              },
            },
          },
          orderBy: {
            communityFeedbackGiven: {
              _count: 'desc',
            },
          },
          take: limitNum,
        });

        leaderboard = users.map((user: any, index: number) => ({
          userId: user.id,
          username: user.username,
          name: user.name,
          score: user._count.communityFeedbackGiven,
          rank: index + 1,
        }));
        break;
      }

      case 'most-popular': {
        // Aggregate feedback received at DB level via raw query
        const results = await prisma.$queryRaw<Array<{
          userId: string;
          username: string | null;
          name: string | null;
          profileImageUrl: string | null;
          total_feedback: bigint;
        }>>`
          SELECT u.id as "userId", u.username, u.name, u."profileImageUrl",
                 COUNT(cf.id) as total_feedback
          FROM "User" u
          JOIN "OutfitCheck" oc ON oc."userId" = u.id AND oc."isPublic" = true AND oc."isDeleted" = false
          JOIN "CommunityFeedback" cf ON cf."outfitId" = oc.id
          WHERE u."isPublic" = true
          GROUP BY u.id, u.username, u.name, u."profileImageUrl"
          ORDER BY total_feedback DESC
          LIMIT ${limitNum}
        `;

        leaderboard = results.map((r: any, index: number) => ({
          userId: r.userId,
          username: r.username,
          name: r.name,
          score: Number(r.total_feedback),
          rank: index + 1,
        }));
        break;
      }

      case 'weekly': {
        // Aggregate avg score this week at DB level
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const grouped = await prisma.outfitCheck.groupBy({
          by: ['userId'],
          where: { isPublic: true, isDeleted: false, aiScore: { not: null }, createdAt: { gte: weekAgo } },
          _avg: { aiScore: true },
          _count: { _all: true },
          orderBy: { _avg: { aiScore: 'desc' } },
          take: limitNum,
        });

        const userIds = grouped.map((g: any) => g.userId);
        const users = await prisma.user.findMany({
          where: { id: { in: userIds }, isPublic: true },
          select: { id: true, username: true, name: true, profileImageUrl: true },
        });
        const userMap = new Map(users.map((u: any) => [u.id, u]));

        leaderboard = grouped
          .filter((g: any) => userMap.has(g.userId))
          .map((g: any, index: number) => ({
            userId: g.userId,
            ...userMap.get(g.userId),
            score: g._avg.aiScore || 0,
            weeklyOutfits: g._count._all,
            rank: index + 1,
          }));
        break;
      }

      default:
        throw new AppError(400, 'Invalid leaderboard type');
    }

    res.json({ leaderboard, type });
  } catch (error) {
    throw error;
  }
}

// Report content (outfit or user)
export async function reportContent(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const data = ReportSchema.parse(req.body);

    // Verify target exists
    if (data.targetType === 'outfit') {
      const outfit = await prisma.outfitCheck.findFirst({
        where: { id: data.targetId, isPublic: true, isDeleted: false },
      });
      if (!outfit) {
        throw new AppError(404, 'Outfit not found');
      }
    } else if (data.targetType === 'user') {
      const user = await prisma.user.findUnique({
        where: { id: data.targetId },
      });
      if (!user) {
        throw new AppError(404, 'User not found');
      }
    }

    // Create report
    const report = await prisma.report.create({
      data: {
        reporterId: userId,
        targetType: data.targetType,
        targetId: data.targetId,
        reason: data.reason,
        details: data.details,
      },
    });

    trackServerEvent(userId, 'report_created', {
      targetType: data.targetType,
      reason: data.reason,
    });

    res.json({ success: true, reportId: report.id });
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new AppError(400, 'Invalid report data');
    }
    throw error;
  }
}

// Block a user
export async function blockUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { username } = req.params;

    // Find user to block
    const userToBlock = await prisma.user.findFirst({
      where: { username },
    });

    if (!userToBlock) {
      throw new AppError(404, 'User not found');
    }

    if (userToBlock.id === userId) {
      throw new AppError(400, 'Cannot block yourself');
    }

    // Check if already blocked
    const existing = await prisma.blockedUser.findUnique({
      where: {
        userId_blockedId: {
          userId,
          blockedId: userToBlock.id,
        },
      },
    });

    if (existing) {
      throw new AppError(400, 'User is already blocked');
    }

    // Create block
    await prisma.blockedUser.create({
      data: {
        userId,
        blockedId: userToBlock.id,
      },
    });

    res.json({ success: true, blocked: userToBlock.username });
  } catch (error) {
    throw error;
  }
}

// Unblock a user
export async function unblockUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { username } = req.params;

    // Find user to unblock
    const userToUnblock = await prisma.user.findFirst({
      where: { username },
    });

    if (!userToUnblock) {
      throw new AppError(404, 'User not found');
    }

    // Delete block
    await prisma.blockedUser.deleteMany({
      where: {
        userId,
        blockedId: userToUnblock.id,
      },
    });

    res.json({ success: true, unblocked: userToUnblock.username });
  } catch (error) {
    throw error;
  }
}

// Get blocked users list
export async function getBlockedUsers(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;

    const blockedUsers = await prisma.blockedUser.findMany({
      where: { userId },
      include: {
        blocked: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      blockedUsers: blockedUsers.map((b) => ({
        id: b.id,
        user: b.blocked,
        blockedAt: b.createdAt,
      })),
    });
  } catch (error) {
    throw error;
  }
}

// Follow a user
export async function followUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { username } = req.params;

    // Find user to follow
    const userToFollow = await prisma.user.findFirst({
      where: { username },
    });

    if (!userToFollow) {
      throw new AppError(404, 'User not found');
    }

    if (userToFollow.id === userId) {
      throw new AppError(400, 'Cannot follow yourself');
    }

    // Check if already following
    const existing = await prisma.follow.findUnique({
      where: {
        followerId_followingId: {
          followerId: userId,
          followingId: userToFollow.id,
        },
      },
    });

    if (existing) {
      throw new AppError(400, 'Already following this user');
    }

    // Create follow
    await prisma.follow.create({
      data: {
        followerId: userId,
        followingId: userToFollow.id,
      },
    });

    // Get follower info for notification
    const follower = await prisma.user.findUnique({
      where: { id: userId },
      select: { username: true, name: true },
    });

    // Create notification for the user being followed
    await createNotification({
      userId: userToFollow.id,
      type: 'follow',
      title: 'New Follower',
      body: `${follower?.username || follower?.name || 'Someone'} started following you`,
      linkType: 'user',
      linkId: userId,
    });

    res.json({ success: true, following: userToFollow.username });
  } catch (error) {
    throw error;
  }
}

// Unfollow a user
export async function unfollowUser(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { username } = req.params;

    // Find user to unfollow
    const userToUnfollow = await prisma.user.findFirst({
      where: { username },
    });

    if (!userToUnfollow) {
      throw new AppError(404, 'User not found');
    }

    // Delete follow
    await prisma.follow.deleteMany({
      where: {
        followerId: userId,
        followingId: userToUnfollow.id,
      },
    });

    res.json({ success: true, unfollowed: userToUnfollow.username });
  } catch (error) {
    throw error;
  }
}

// Get user's followers
export async function getFollowers(req: AuthenticatedRequest, res: Response) {
  try {
    const { username } = req.params;

    // Find user
    const user = await prisma.user.findFirst({
      where: { username },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const followers = await prisma.follow.findMany({
      where: { followingId: user.id },
      include: {
        follower: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      followers: followers.map((f) => ({
        ...f.follower,
        followedAt: f.createdAt,
      })),
    });
  } catch (error) {
    throw error;
  }
}

// Get users that a user is following
export async function getFollowing(req: AuthenticatedRequest, res: Response) {
  try {
    const { username } = req.params;

    // Find user
    const user = await prisma.user.findFirst({
      where: { username },
    });

    if (!user) {
      throw new AppError(404, 'User not found');
    }

    const following = await prisma.follow.findMany({
      where: { followerId: user.id },
      include: {
        following: {
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
          },
        },
      },
      orderBy: { createdAt: 'desc' },
    });

    res.json({
      following: following.map((f) => ({
        ...f.following,
        followedAt: f.createdAt,
      })),
    });
  } catch (error) {
    throw error;
  }
}

// ============================================================
// INNER CIRCLE
// ============================================================

// GET /api/social/inner-circle — list members of MY inner circle
export async function getInnerCircle(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const members = await prisma.innerCircleMember.findMany({
      where: { userId },
      include: {
        member: {
          select: { id: true, username: true, name: true, profileImageUrl: true },
        },
      },
      orderBy: { createdAt: 'asc' },
    });
    res.json({ members: members.map((m) => ({ ...m.member, addedAt: m.createdAt })) });
  } catch (error) {
    throw error;
  }
}

// POST /api/social/users/:username/inner-circle — add user to MY inner circle
export async function addToInnerCircle(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { username } = req.params;

    const target = await prisma.user.findFirst({ where: { username } });
    if (!target) throw new AppError(404, 'User not found');
    if (target.id === userId) throw new AppError(400, 'Cannot add yourself to your inner circle');

    const existing = await prisma.innerCircleMember.findUnique({
      where: { userId_memberId: { userId, memberId: target.id } },
    });
    if (existing) throw new AppError(400, 'User is already in your inner circle');

    await prisma.innerCircleMember.create({ data: { userId, memberId: target.id } });

    // Notify the person they were added
    await createNotification({
      userId: target.id,
      type: 'inner_circle',
      title: 'You\'ve been added to an inner circle',
      body: 'Someone added you to their inner circle. You\'ll now see their private outfit posts.',
      linkType: 'user',
      linkId: userId,
    });

    res.json({ success: true, added: target.username });
  } catch (error) {
    throw error;
  }
}

// DELETE /api/social/users/:username/inner-circle — remove user from MY inner circle
export async function removeFromInnerCircle(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { username } = req.params;

    const target = await prisma.user.findFirst({ where: { username } });
    if (!target) throw new AppError(404, 'User not found');

    await prisma.innerCircleMember.deleteMany({
      where: { userId, memberId: target.id },
    });

    res.json({ success: true, removed: target.username });
  } catch (error) {
    throw error;
  }
}

// GET /api/social/users/:username/inner-circle/status — check if a user is in my inner circle
export async function getInnerCircleStatus(req: AuthenticatedRequest, res: Response) {
  try {
    const userId = req.userId!;
    const { username } = req.params;

    const target = await prisma.user.findFirst({ where: { username } });
    if (!target) throw new AppError(404, 'User not found');

    const member = await prisma.innerCircleMember.findUnique({
      where: { userId_memberId: { userId, memberId: target.id } },
    });

    res.json({ isInCircle: !!member });
  } catch (error) {
    throw error;
  }
}
