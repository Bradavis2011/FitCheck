import { Request, Response } from 'express';
import { Webhook } from 'svix';
import { AppError } from '../middleware/errorHandler.js';
import { prisma } from '../utils/prisma.js';
import { trackServerEvent } from '../lib/posthog.js';

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
      // If a different DB record already holds this email (e.g. user deleted Clerk
      // account and re-registered), delete it so cascade removes orphaned rows.
      const stale = await prisma.user.findUnique({ where: { email } });
      if (stale && stale.id !== id) {
        await prisma.user.delete({ where: { id: stale.id } });
        console.log(`✓ Deleted stale user ${stale.id} (${email}) before re-register`);
      }

      const user = await prisma.user.upsert({
        where: { id },
        create: { id, email, name: fullName },
        update: { email, name: fullName },
      });

      await prisma.userStats.upsert({
        where: { userId: user.id },
        create: { userId: user.id },
        update: {},
      });

      trackServerEvent(user.id, 'user_registered', { source: 'clerk_webhook' });
      console.log(`✓ Upserted user ${user.id} (${email})`);
    } else if (eventType === 'user.updated') {
      // Upsert — handles case where user.created webhook was lost
      await prisma.user.upsert({
        where: { id },
        create: { id, email, name: fullName },
        update: { email, name: fullName },
      });

      console.log(`✓ Updated user ${id} (${email})`);
    }

    res.json({ success: true });
  } catch (error) {
    console.error('Clerk webhook error:', error);
    throw error;
  }
}
