import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';

/**
 * Clerk Webhook Handler
 *
 * Handles user.created and user.updated events from Clerk
 * Syncs Clerk users to our database
 */
export async function handleClerkWebhook(req: Request, res: Response) {
  try {
    const WEBHOOK_SECRET = process.env.CLERK_WEBHOOK_SECRET;
    if (!WEBHOOK_SECRET) {
      throw new AppError(500, 'Clerk webhook secret not configured');
    }

    // Verify webhook signature
    const svix_id = req.headers['svix-id'] as string;
    const svix_timestamp = req.headers['svix-timestamp'] as string;
    const svix_signature = req.headers['svix-signature'] as string;

    if (!svix_id || !svix_timestamp || !svix_signature) {
      throw new AppError(400, 'Missing svix headers');
    }

    const wh = new Webhook(WEBHOOK_SECRET);
    let evt: any;

    try {
      evt = wh.verify(JSON.stringify(req.body), {
        'svix-id': svix_id,
        'svix-timestamp': svix_timestamp,
        'svix-signature': svix_signature,
      });
    } catch (err) {
      console.error('Webhook signature verification failed:', err);
      throw new AppError(400, 'Invalid webhook signature');
    }

    const { id, email_addresses, first_name, last_name } = evt.data;
    const eventType = evt.type;

    // Get primary email
    const primaryEmail = email_addresses?.find(
      (e: any) => e.id === evt.data.primary_email_address_id
    );
    const email = primaryEmail?.email_address;

    if (!email) {
      throw new AppError(400, 'Email is required');
    }

    const fullName = first_name && last_name
      ? `${first_name} ${last_name}`
      : first_name || null;

    if (eventType === 'user.created') {
      // Create user in our database
      const user = await prisma.user.create({
        data: {
          id,
          email,
          name: fullName,
        },
      });

      // Create user stats
      await prisma.userStats.create({
        data: { userId: user.id },
      });

      console.log(`✓ Created user ${user.id} (${email})`);
    } else if (eventType === 'user.updated') {
      // Update user in our database
      await prisma.user.update({
        where: { id },
        data: {
          email,
          name: fullName,
        },
      });

      console.log(`✓ Updated user ${id} (${email})`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Clerk webhook error:', error);
    throw error;
  }
}
