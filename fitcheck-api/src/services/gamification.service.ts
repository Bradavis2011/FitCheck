import { prisma } from '../utils/prisma.js';

// Level thresholds
const LEVEL_THRESHOLDS = [
  { level: 1, pointsRequired: 0, name: 'Style Newbie' },
  { level: 2, pointsRequired: 100, name: 'Fashion Friend' },
  { level: 3, pointsRequired: 250, name: 'Style Advisor' },
  { level: 4, pointsRequired: 500, name: 'Outfit Expert' },
  { level: 5, pointsRequired: 1000, name: 'Trusted Reviewer' },
  { level: 6, pointsRequired: 2000, name: 'Style Guru' },
  { level: 7, pointsRequired: 5000, name: 'Fashion Icon' },
  { level: 8, pointsRequired: 10000, name: 'Legend' },
];

export function getLevelFromPoints(points: number): { level: number; name: string; xpToNext: number } {
  let currentLevel = LEVEL_THRESHOLDS[0];
  let nextLevel = LEVEL_THRESHOLDS[1];

  for (let i = LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (points >= LEVEL_THRESHOLDS[i].pointsRequired) {
      currentLevel = LEVEL_THRESHOLDS[i];
      nextLevel = LEVEL_THRESHOLDS[i + 1] || LEVEL_THRESHOLDS[i]; // Max level
      break;
    }
  }

  const xpToNext = nextLevel.pointsRequired - points;

  return {
    level: currentLevel.level,
    name: currentLevel.name,
    xpToNext: xpToNext > 0 ? xpToNext : 0,
  };
}

interface AwardPointsOptions {
  userId: string;
  points: number;
  reason: string;
}

export async function awardPoints({ userId, points, reason }: AwardPointsOptions) {
  // Get or create user stats
  let stats = await prisma.userStats.findUnique({
    where: { userId },
  });

  if (!stats) {
    stats = await prisma.userStats.create({
      data: { userId },
    });
  }

  const oldPoints = stats.points;
  const oldLevel = stats.level;
  const newPoints = oldPoints + points;

  // Calculate new level
  const { level: newLevel, xpToNext } = getLevelFromPoints(newPoints);
  const leveledUp = newLevel > oldLevel;

  // Update stats
  const updatedStats = await prisma.userStats.update({
    where: { userId },
    data: {
      points: newPoints,
      level: newLevel,
      xpToNextLevel: xpToNext,
      weeklyPoints: { increment: points },
      monthlyPoints: { increment: points },
    },
  });

  // Check for new badges
  const newBadges = await checkAndAwardBadges(userId, updatedStats);

  return {
    pointsAwarded: points,
    totalPoints: newPoints,
    level: newLevel,
    leveledUp,
    oldLevel,
    newBadges,
    reason,
  };
}

// Award points for giving feedback
export async function awardFeedbackPoints(userId: string, isFirstResponder: boolean = false) {
  let points = 10; // Base points
  let reason = 'Gave feedback';

  if (isFirstResponder) {
    points += 5; // First responder bonus
    reason += ' (first responder!)';
  }

  // Check for daily milestone
  const stats = await prisma.userStats.findUnique({ where: { userId } });
  if (stats) {
    const today = new Date().toDateString();
    const lastActive = stats.dailyGoalsResetAt?.toDateString();

    // Reset daily counter if new day
    if (lastActive !== today) {
      await prisma.userStats.update({
        where: { userId },
        data: {
          dailyFeedbackCount: 0,
          dailyHelpfulVotes: 0,
          dailyGoalsResetAt: new Date(),
        },
      });
    }

    const newDailyCount = (stats.dailyFeedbackCount || 0) + 1;

    // Update daily counter
    await prisma.userStats.update({
      where: { userId },
      data: { dailyFeedbackCount: newDailyCount },
    });

    // Bonus for 5 feedbacks in one day
    if (newDailyCount === 5) {
      points += 50;
      reason += ' + Marathon bonus!';
    }

    // Diminishing returns
    if (newDailyCount > 10) {
      points = Math.floor(points * 0.5); // 50% after 10 feedbacks
    } else if (newDailyCount > 5) {
      points = Math.floor(points * 0.8); // 80% after 5 feedbacks
    }
  }

  return awardPoints({ userId, points, reason });
}

// Award points when feedback is rated helpful
export async function awardHelpfulPoints(userId: string) {
  const points = 25; // 2.5x multiplier
  const reason = 'Feedback rated helpful!';

  const stats = await prisma.userStats.findUnique({ where: { userId } });
  if (stats) {
    await prisma.userStats.update({
      where: { userId },
      data: {
        totalHelpfulVotes: { increment: 1 },
        dailyHelpfulVotes: { increment: 1 },
      },
    });
  }

  return awardPoints({ userId, points, reason });
}

// Update streak
export async function updateStreak(userId: string) {
  const stats = await prisma.userStats.findUnique({
    where: { userId },
  });

  if (!stats) return;

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const lastActive = stats.lastActiveDate ? new Date(stats.lastActiveDate) : null;
  if (lastActive) {
    lastActive.setHours(0, 0, 0, 0);
  }

  const daysSinceLastActive = lastActive
    ? Math.floor((today.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24))
    : 0;

  let newStreak = stats.currentStreak;
  let streakBroken = false;

  if (daysSinceLastActive === 0) {
    // Already active today, no change
    return { streakMaintained: true, currentStreak: newStreak };
  } else if (daysSinceLastActive === 1) {
    // Consecutive day, increment streak
    newStreak += 1;
  } else if (daysSinceLastActive > 1) {
    // Check if streak freeze is available (used this week)
    const weekStart = new Date(today);
    weekStart.setDate(today.getDate() - today.getDay()); // Start of week (Sunday)

    if (!stats.streakFreezeUsed && daysSinceLastActive === 2) {
      // Use streak freeze for 1-day miss
      newStreak = stats.currentStreak; // Keep streak
      await prisma.userStats.update({
        where: { userId },
        data: { streakFreezeUsed: true },
      });
    } else {
      // Streak broken
      newStreak = 1;
      streakBroken = true;
    }
  }

  // Update longest streak
  const longestStreak = Math.max(stats.longestStreak, newStreak);

  await prisma.userStats.update({
    where: { userId },
    data: {
      currentStreak: newStreak,
      longestStreak,
      lastActiveDate: today,
    },
  });

  // Award streak points
  if (!streakBroken && newStreak > 1) {
    await awardPoints({
      userId,
      points: 10,
      reason: `${newStreak}-day streak maintained!`,
    });
  }

  return {
    streakMaintained: !streakBroken,
    currentStreak: newStreak,
    longestStreak,
  };
}

// Check and award badges
async function checkAndAwardBadges(userId: string, stats: any) {
  const currentBadges = stats.badges || [];
  const newBadges: string[] = [];

  // Badge definitions
  const badgeChecks = [
    {
      id: 'helpful_hero',
      condition: stats.totalHelpfulVotes >= 50,
      name: 'Helpful Hero',
      description: 'Received 50 helpful votes',
      icon: '⭐',
    },
    {
      id: 'streak_master',
      condition: stats.longestStreak >= 30,
      name: 'Streak Master',
      description: '30-day streak achieved',
      icon: '🔥',
    },
    {
      id: 'century_club',
      condition: stats.totalFeedbackGiven >= 100,
      name: 'Century Club',
      description: 'Gave 100 feedbacks',
      icon: '💯',
    },
    {
      id: 'trusted_reviewer',
      condition: stats.level >= 5 && stats.totalFeedbackGiven >= 20,
      name: 'Trusted Reviewer',
      description: 'Reached Level 5 with quality feedback',
      icon: '✅',
    },
    {
      id: 'dedicated',
      condition: stats.longestStreak >= 7,
      name: 'Dedicated',
      description: '7-day streak achieved',
      icon: '🎯',
    },
  ];

  for (const badge of badgeChecks) {
    if (badge.condition && !currentBadges.includes(badge.id)) {
      currentBadges.push(badge.id);
      newBadges.push(badge.id);
    }
  }

  // Update badges if new ones were earned
  if (newBadges.length > 0) {
    await prisma.userStats.update({
      where: { userId },
      data: { badges: currentBadges },
    });
  }

  return newBadges;
}

// Reset weekly/monthly points (called by cron job)
export async function resetWeeklyPoints() {
  const weekAgo = new Date();
  weekAgo.setDate(weekAgo.getDate() - 7);

  await prisma.userStats.updateMany({
    where: {
      lastWeeklyReset: {
        lte: weekAgo,
      },
    },
    data: {
      weeklyPoints: 0,
      lastWeeklyReset: new Date(),
      streakFreezeUsed: false, // Reset streak freeze weekly
    },
  });

  console.log('✅ Weekly points reset completed');
}

export async function resetMonthlyPoints() {
  const monthAgo = new Date();
  monthAgo.setMonth(monthAgo.getMonth() - 1);

  await prisma.userStats.updateMany({
    where: {
      lastMonthlyReset: {
        lte: monthAgo,
      },
    },
    data: {
      monthlyPoints: 0,
      lastMonthlyReset: new Date(),
    },
  });

  console.log('✅ Monthly points reset completed');
}

// Get leaderboard
export async function getLeaderboard(type: 'weekly' | 'monthly' | 'alltime', limit: number = 50) {
  let orderBy: any;

  switch (type) {
    case 'weekly':
      orderBy = { weeklyPoints: 'desc' };
      break;
    case 'monthly':
      orderBy = { monthlyPoints: 'desc' };
      break;
    case 'alltime':
      orderBy = { points: 'desc' };
      break;
  }

  const leaderboard = await prisma.userStats.findMany({
    where: {
      // Minimum threshold to appear on leaderboard
      totalFeedbackGiven: { gte: type === 'alltime' ? 10 : 1 },
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
    orderBy,
    take: limit,
  });

  return leaderboard.map((entry, index) => ({
    rank: index + 1,
    userId: entry.userId,
    username: entry.user.username || entry.user.name || 'Anonymous',
    profileImageUrl: entry.user.profileImageUrl,
    points: type === 'weekly' ? entry.weeklyPoints : type === 'monthly' ? entry.monthlyPoints : entry.points,
    level: entry.level,
    badges: entry.badges,
  }));
}

// Get user's rank on leaderboard
export async function getUserRank(userId: string, type: 'weekly' | 'monthly' | 'alltime') {
  let orderBy: any;
  let pointsField: string;

  switch (type) {
    case 'weekly':
      orderBy = { weeklyPoints: 'desc' };
      pointsField = 'weeklyPoints';
      break;
    case 'monthly':
      orderBy = { monthlyPoints: 'desc' };
      pointsField = 'monthlyPoints';
      break;
    case 'alltime':
      orderBy = { points: 'desc' };
      pointsField = 'points';
      break;
  }

  const userStats = await prisma.userStats.findUnique({
    where: { userId },
  });

  if (!userStats) return null;

  const userPoints = (userStats as any)[pointsField];

  const rank = await prisma.userStats.count({
    where: {
      [pointsField]: { gt: userPoints },
      totalFeedbackGiven: { gte: type === 'alltime' ? 10 : 1 },
    },
  });

  return rank + 1; // +1 because count gives number of people above
}

// Get daily goals progress
export async function getDailyGoalsProgress(userId: string) {
  const stats = await prisma.userStats.findUnique({
    where: { userId },
  });

  if (!stats) {
    return {
      feedbacksGiven: 0,
      feedbacksGoal: 3,
      helpfulVotes: 0,
      helpfulGoal: 1,
      streakMaintained: false,
      currentStreak: 0,
    };
  }

  // Check if today's goals
  const today = new Date().toDateString();
  const lastReset = stats.dailyGoalsResetAt?.toDateString();
  const isToday = lastReset === today;

  return {
    feedbacksGiven: isToday ? stats.dailyFeedbackCount : 0,
    feedbacksGoal: 3,
    helpfulVotes: isToday ? stats.dailyHelpfulVotes : 0,
    helpfulGoal: 1,
    streakMaintained: stats.lastActiveDate?.toDateString() === today,
    currentStreak: stats.currentStreak,
  };
}

// Badge metadata (for display)
export const BADGE_METADATA: Record<string, { name: string; description: string; icon: string }> = {
  helpful_hero: {
    name: 'Helpful Hero',
    description: 'Received 50 helpful votes',
    icon: '⭐',
  },
  streak_master: {
    name: 'Streak Master',
    description: '30-day streak achieved',
    icon: '🔥',
  },
  century_club: {
    name: 'Century Club',
    description: 'Gave 100 feedbacks',
    icon: '💯',
  },
  trusted_reviewer: {
    name: 'Trusted Reviewer',
    description: 'Level 5 with quality feedback',
    icon: '✅',
  },
  dedicated: {
    name: 'Dedicated',
    description: '7-day streak achieved',
    icon: '🎯',
  },
  early_bird: {
    name: 'Early Bird',
    description: 'Gave feedback before 9am (5 times)',
    icon: '🌅',
  },
  night_owl: {
    name: 'Night Owl',
    description: 'Gave feedback after 10pm (5 times)',
    icon: '🦉',
  },
};
