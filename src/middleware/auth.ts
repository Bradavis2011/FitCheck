import { Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../utils/prisma.js';

const CLERK_SECRET_KEY = process.env.CLERK_SECRET_KEY;
if (!CLERK_SECRET_KEY) {
  throw new Error('FATAL: CLERK_SECRET_KEY environment variable is not set.');
}

export async function authenticateToken(
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction
): Promise<void> {
  try {
    const authHeader = req.headers.authorization;
    const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

    if (!token) {
      return res.status(401).json({ error: 'Authentication required' });
    }

    // Verify Clerk session token
    let clerkUserId: string;
    try {
      const sessionClaims = await clerkClient.verifyToken(token);
      clerkUserId = sessionClaims.sub; // Clerk user ID
    } catch (error) {
      return res.status(403).json({ error: 'Invalid or expired token' });
    }

    // Fetch user from database using Clerk ID
    const user = await prisma.user.findUnique({
      where: { id: clerkUserId },
      select: { id: true, email: true, tier: true }
    });

    if (!user) {
      // User exists in Clerk but not in our DB - sync them
      try {
        const clerkUser = await clerkClient.users.getUser(clerkUserId);
        const email = clerkUser.emailAddresses.find(e => e.id === clerkUser.primaryEmailAddressId)?.emailAddress;

        if (!email) {
          return res.status(401).json({ error: 'User email not found' });
        }

        const newUser = await prisma.user.create({
          data: {
            id: clerkUserId,
            email,
            name: clerkUser.firstName && clerkUser.lastName
              ? `${clerkUser.firstName} ${clerkUser.lastName}`
              : clerkUser.firstName || null,
          },
        });

        // Create user stats
        await prisma.userStats.create({
          data: { userId: newUser.id },
        });

        req.userId = newUser.id;
        req.user = { id: newUser.id, email: newUser.email, tier: newUser.tier };
        next();
      } catch (error) {
        console.error('Failed to sync Clerk user:', error);
        return res.status(500).json({ error: 'Failed to sync user' });
      }
    } else {
      req.userId = user.id;
      req.user = user;
      next();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    return res.status(500).json({ error: 'Authentication failed' });
  }
}
