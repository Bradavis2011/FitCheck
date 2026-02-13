import { Response } from 'express';
import { z } from 'zod';
import { AuthenticatedRequest } from '../types/index.js';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { createNotification } from './notification.controller.js';

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

    if (!q || typeof q !== 'string' || q.trim().length < 2) {
      throw new AppError(400, 'Search query must be at least 2 characters');
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
    const { limit = '20', offset = '0', filter = 'recent' } = req.query;

    // Get blocked user IDs
    const blockedUsers = await prisma.blockedUser.findMany({
      where: { userId },
      select: { blockedId: true },
    });
    const blockedUserIds = blockedUsers.map((b) => b.blockedId);

    // Determine sort order based on filter
    let orderBy: any = { createdAt: 'desc' }; // Default: recent

    if (filter === 'popular') {
      // Sort by feedback count (most feedback)
      orderBy = { communityFeedback: { _count: 'desc' } };
    } else if (filter === 'top-rated') {
      // Sort by AI score (highest rated)
      orderBy = { aiScore: 'desc' };
    }

    const outfits = await prisma.outfitCheck.findMany({
      where: {
        isPublic: true,
        isDeleted: false,
        user: { isPublic: true },
        NOT: { userId: { in: blockedUserIds } },
      },
      select: {
        id: true,
        thumbnailUrl: true,
        thumbnailData: true,
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

    const total = await prisma.outfitCheck.count({
      where: {
        isPublic: true,
        isDeleted: false,
        user: { isPublic: true },
        NOT: { userId: { in: blockedUserIds } },
      },
    });

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
    const data = FeedbackSchema.parse(req.body);

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

    res.json(feedback);
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
    const limitNum = parseInt(limit as string);

    let leaderboard: any[] = [];

    switch (type) {
      case 'top-rated': {
        // Users with highest avg outfit scores (min 5 public outfits)
        const users = await prisma.user.findMany({
          where: {
            isPublic: true,
            outfitChecks: {
              some: {
                isPublic: true,
                isDeleted: false,
              },
            },
          },
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
            outfitChecks: {
              where: {
                isPublic: true,
                isDeleted: false,
                aiScore: { not: null },
              },
              select: {
                aiScore: true,
              },
            },
          },
        });

        leaderboard = users
          .map((user) => {
            const scores = user.outfitChecks.map((o) => o.aiScore || 0);
            const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            return {
              userId: user.id,
              username: user.username,
              name: user.name,
              score: avgScore,
              outfitCount: scores.length,
            };
          })
          .filter((user) => user.outfitCount >= 5)
          .sort((a, b) => b.score - a.score)
          .slice(0, limitNum)
          .map((user, index) => ({ ...user, rank: index + 1 }));
        break;
      }

      case 'most-helpful': {
        // Users who give most feedback
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

        leaderboard = users.map((user, index) => ({
          userId: user.id,
          username: user.username,
          name: user.name,
          score: user._count.communityFeedbackGiven,
          rank: index + 1,
        }));
        break;
      }

      case 'most-popular': {
        // Users with most community feedback received
        const users = await prisma.user.findMany({
          where: {
            isPublic: true,
            outfitChecks: {
              some: {
                isPublic: true,
                isDeleted: false,
              },
            },
          },
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
            outfitChecks: {
              where: {
                isPublic: true,
                isDeleted: false,
              },
              select: {
                _count: {
                  select: {
                    communityFeedback: true,
                  },
                },
              },
            },
          },
        });

        leaderboard = users
          .map((user) => {
            const totalFeedback = user.outfitChecks.reduce(
              (sum, outfit) => sum + outfit._count.communityFeedback,
              0
            );
            return {
              userId: user.id,
              username: user.username,
              name: user.name,
              score: totalFeedback,
            };
          })
          .sort((a, b) => b.score - a.score)
          .slice(0, limitNum)
          .map((user, index) => ({ ...user, rank: index + 1 }));
        break;
      }

      case 'weekly': {
        // Users with best performance this week
        const weekAgo = new Date();
        weekAgo.setDate(weekAgo.getDate() - 7);

        const users = await prisma.user.findMany({
          where: {
            isPublic: true,
            outfitChecks: {
              some: {
                isPublic: true,
                isDeleted: false,
                createdAt: { gte: weekAgo },
              },
            },
          },
          select: {
            id: true,
            username: true,
            name: true,
            profileImageUrl: true,
            outfitChecks: {
              where: {
                isPublic: true,
                isDeleted: false,
                createdAt: { gte: weekAgo },
                aiScore: { not: null },
              },
              select: {
                aiScore: true,
              },
            },
          },
        });

        leaderboard = users
          .map((user) => {
            const scores = user.outfitChecks.map((o) => o.aiScore || 0);
            const avgScore = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : 0;
            return {
              userId: user.id,
              username: user.username,
              name: user.name,
              score: avgScore,
              weeklyOutfits: scores.length,
            };
          })
          .filter((user) => user.weeklyOutfits > 0)
          .sort((a, b) => b.score - a.score)
          .slice(0, limitNum)
          .map((user, index) => ({ ...user, rank: index + 1 }));
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
