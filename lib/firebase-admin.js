import admin from 'firebase-admin';
import { getApps } from 'firebase-admin/app';
import { getMessaging } from 'firebase-admin/messaging';
import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

// Initialize Firebase Admin SDK
if (!getApps().length) {
  try {
    const encodedServiceAccount = process.env.FIREBASE_SERVICE_ACCOUNT_KEY;
    if (!encodedServiceAccount) {
      console.warn("FIREBASE_SERVICE_ACCOUNT_KEY environment variable not set. Push notifications will be disabled.");
      // Don't throw error, just log warning
    } else {
      // Decode the Base64 string to get the JSON string
      const decodedServiceAccount = Buffer.from(encodedServiceAccount, 'base64').toString('utf-8');
      const serviceAccount = JSON.parse(decodedServiceAccount);

      admin.initializeApp({
        credential: admin.credential.cert(serviceAccount),
      });
      
      console.log('Firebase Admin SDK initialized successfully');
    }
  } catch (error) {
    console.error('Error initializing Firebase Admin SDK:', error);
    console.warn('Push notifications will be disabled due to Firebase initialization failure');
  }
}

/**
 * Send a push notification to a specific user
 * @param {string} userId - The user ID to send the notification to
 * @param {object} notification - The notification object
 * @param {string} notification.title - The notification title
 * @param {string} notification.body - The notification body
 * @param {object} [notification.data] - Additional data to send with the notification
 * @returns {Promise<void>}
 */
export async function sendPushNotificationToUser(userId, notification) {
  try {
    // Check if Firebase is initialized
    if (getApps().length === 0) {
      console.log(`Firebase not initialized. Skipping push notification for user ${userId}`);
      return;
    }

    // Get the user's device tokens from the database
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId,
        // Only use tokens for FCM (Firebase Cloud Messaging)
        tokenType: 'FCM'
      },
      select: {
        token: true,
      },
    });

    if (!deviceTokens.length) {
      console.log(`No FCM device tokens found for user ${userId}`);
      return;
    }

    const tokens = deviceTokens.map((dt) => dt.token);
    
    // Send the notification to all user devices
    const message = {
      notification: {
        title: notification.title,
        body: notification.body,
      },
      data: notification.data || {},
      tokens: tokens,
    };

    const response = await getMessaging().sendMulticast(message);
    
    console.log(`Successfully sent notifications to ${response.successCount} devices for user ${userId}`);
    
    // Handle failed tokens
    if (response.failureCount > 0) {
      const failedTokens = [];
      response.responses.forEach((resp, idx) => {
        if (!resp.success) {
          failedTokens.push(tokens[idx]);
        }
      });
      
      console.log(`Failed to send notifications to ${failedTokens.length} devices`);
      
      // Clean up failed tokens
      if (failedTokens.length > 0) {
        await prisma.deviceToken.deleteMany({
          where: {
            token: {
              in: failedTokens,
            },
          },
        });
        console.log(`Removed ${failedTokens.length} invalid tokens from the database`);
      }
    }
  } catch (error) {
    console.error('Error sending push notification:', error);
  }
}

/**
 * Send a push notification to multiple users
 * @param {string[]} userIds - Array of user IDs to send the notification to
 * @param {object} notification - The notification object
 * @returns {Promise<void>}
 */
export async function sendPushNotificationToUsers(userIds, notification) {
  try {
    for (const userId of userIds) {
      await sendPushNotificationToUser(userId, notification);
    }
  } catch (error) {
    console.error('Error sending push notifications to multiple users:', error);
  }
}

/**
 * Send a Firebase notification (alias for sendPushNotificationToUser)
 */
export const sendFirebaseNotification = sendPushNotificationToUser; 