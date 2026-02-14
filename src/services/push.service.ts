import { Expo, ExpoPushMessage, ExpoPushTicket } from 'expo-server-sdk';
import { prisma } from '../utils/prisma.js';

export class PushService {
  private expo: Expo;

  constructor() {
    this.expo = new Expo();
  }

  /**
   * Send a push notification to a user
   */
  async sendPushNotification(
    userId: string,
    notification: {
      title: string;
      body: string;
      data?: any;
    }
  ): Promise<void> {
    try {
      // Get all push tokens for this user
      const pushTokens = await prisma.pushToken.findMany({
        where: { userId },
      });

      if (pushTokens.length === 0) {
        console.log(`No push tokens found for user ${userId}`);
        return;
      }

      // Filter valid Expo push tokens
      const validTokens = pushTokens
        .map((pt) => pt.token)
        .filter((token) => Expo.isExpoPushToken(token));

      if (validTokens.length === 0) {
        console.log(`No valid Expo push tokens for user ${userId}`);
        return;
      }

      // Build push messages
      const messages: ExpoPushMessage[] = validTokens.map((token) => ({
        to: token,
        sound: 'default',
        title: notification.title,
        body: notification.body,
        data: notification.data || {},
      }));

      // Send in chunks (Expo requires batching)
      const chunks = this.expo.chunkPushNotifications(messages);
      const tickets: ExpoPushTicket[] = [];

      for (const chunk of chunks) {
        try {
          const ticketChunk = await this.expo.sendPushNotificationsAsync(chunk);
          tickets.push(...ticketChunk);
        } catch (error) {
          console.error('Error sending push notification chunk:', error);
        }
      }

      // Log results
      console.log(`✅ Sent ${tickets.length} push notifications to user ${userId}`);

      // Check for errors and remove invalid tokens
      tickets.forEach((ticket, index) => {
        if (ticket.status === 'error') {
          console.error(`Push notification error: ${ticket.message}`);

          // If token is invalid, remove it from database
          if (ticket.details?.error === 'DeviceNotRegistered') {
            const invalidToken = validTokens[index];
            this.removeInvalidToken(invalidToken);
          }
        }
      });
    } catch (error) {
      console.error('Error in sendPushNotification:', error);
    }
  }

  /**
   * Send push notification to multiple users
   */
  async sendPushNotificationToUsers(
    userIds: string[],
    notification: {
      title: string;
      body: string;
      data?: any;
    }
  ): Promise<void> {
    await Promise.all(
      userIds.map((userId) => this.sendPushNotification(userId, notification))
    );
  }

  /**
   * Remove an invalid push token from the database
   */
  private async removeInvalidToken(token: string): Promise<void> {
    try {
      await prisma.pushToken.delete({
        where: { token },
      });
      console.log(`Removed invalid push token: ${token}`);
    } catch (error) {
      console.error('Error removing invalid token:', error);
    }
  }

  /**
   * Register a new push token for a user
   */
  async registerPushToken(
    userId: string,
    token: string,
    platform: 'ios' | 'android'
  ): Promise<void> {
    try {
      // Check if token is valid
      if (!Expo.isExpoPushToken(token)) {
        throw new Error('Invalid Expo push token');
      }

      // Upsert the token
      await prisma.pushToken.upsert({
        where: { token },
        create: {
          userId,
          token,
          platform,
        },
        update: {
          userId,
          platform,
        },
      });

      console.log(`✅ Registered push token for user ${userId} (${platform})`);
    } catch (error) {
      console.error('Error registering push token:', error);
      throw error;
    }
  }

  /**
   * Unregister a push token
   */
  async unregisterPushToken(token: string): Promise<void> {
    try {
      await prisma.pushToken.delete({
        where: { token },
      });
      console.log(`✅ Unregistered push token: ${token}`);
    } catch (error) {
      console.error('Error unregistering push token:', error);
      throw error;
    }
  }
}

// Singleton instance
export const pushService = new PushService();
