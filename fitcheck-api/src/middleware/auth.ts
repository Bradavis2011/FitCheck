import { Response, NextFunction } from 'express';
import { clerkClient } from '@clerk/clerk-sdk-node';
import { AuthenticatedRequest } from '../types/index.js';
import { prisma } from '../utils/prisma.js';

// Clerk secret key - loaded at runtime from .env
function getClerkSecretKey(): string | undefined {
  return process.env.CLERK_SECRET_KEY;
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
      res.status(401).json({ error: 'Authentication required' });
      return;
    }

    // Verify Clerk token - no fallbacks
    let clerkUserId: string;
    try {
      const sessionClaims = await clerkClient.verifyToken(token);
      clerkUserId = sessionClaims.sub; // Clerk user ID
    } catch (clerkError) {
      console.error('Clerk token verification failed:', clerkError);
      res.status(403).json({ error: 'Invalid or expired token' });
      return;
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
          res.status(401).json({ error: 'User email not found' });
          return;
        }

        const name = clerkUser.firstName && clerkUser.lastName
          ? `${clerkUser.firstName} ${clerkUser.lastName}`
          : clerkUser.firstName || null;

        // If a stale record holds this email (re-registration with new Clerk ID),
        // delete it so cascade removes orphaned rows, then create fresh.
        const stale = await prisma.user.findUnique({ where: { email } });
        if (stale && stale.id !== clerkUserId) {
          await prisma.user.delete({ where: { id: stale.id } });
        }

        const newUser = await prisma.user.upsert({
          where: { id: clerkUserId },
          create: { id: clerkUserId, email, name },
          update: { email, name },
        });

        await prisma.userStats.upsert({
          where: { userId: newUser.id },
          update: {},
          create: { userId: newUser.id },
        });

        req.userId = newUser.id;
        req.user = { id: newUser.id, email: newUser.email, tier: newUser.tier };
        next();
      } catch (error) {
        console.error('Failed to sync Clerk user:', error);
        res.status(500).json({ error: 'Failed to sync user' });
        return;
      }
    } else {
      req.userId = user.id;
      req.user = user;
      next();
    }
  } catch (error) {
    console.error('Authentication error:', error);
    res.status(500).json({ error: 'Authentication failed' });
    return;
  }
}
