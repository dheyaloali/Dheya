import * as admin from 'firebase-admin';
import { prisma } from './prisma';
import type { DeviceToken, Employee } from '@prisma/client';

// Initialize Firebase Admin SDK if not already initialized
if (!admin.apps.length) {
  try {
    // Check for environment variables
    if (process.env.FIREBASE_PROJECT_ID && 
        process.env.FIREBASE_CLIENT_EMAIL && 
        process.env.FIREBASE_PRIVATE_KEY) {
      
      // Initialize with environment variables
      admin.initializeApp({
        credential: admin.credential.cert({
          projectId: process.env.FIREBASE_PROJECT_ID,
          clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
          // The private key comes as a string with "\n" character sequences
          // We need to replace them with actual newlines
          privateKey: process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
        }),
      });
    } else {
      // Fall back to application default credentials or initialize with minimal config
      admin.initializeApp({
        // If running on Firebase hosting, no credentials needed
        // Otherwise, this will use Application Default Credentials if available
      });
    }
    console.log('Firebase Admin SDK initialized successfully');
  } catch (error) {
    console.error('Firebase Admin SDK initialization error:', error);
  }
}

/**
 * Send a push notification to a specific user
 * 
 * @param userId User ID to send notification to
 * @param title Notification title
 * @param body Notification body
 * @param data Additional data to send with notification
 * @returns Promise with the messaging results
 */
export async function sendPushNotificationToUser(
  userId: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    // Get user's device tokens
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId,
        tokenType: 'fcm', // Only get FCM tokens
      },
      select: {
        token: true,
      },
    });

    if (!deviceTokens.length) {
      console.log(`No FCM tokens found for user ${userId}`);
      return { success: false, message: 'No device tokens found' };
    }

    // Extract tokens
    const tokens = deviceTokens.map((dt) => dt.token);

    // Send notification
    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(
      `Successfully sent notifications: ${response.successCount}/${tokens.length}`
    );
    
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      results: response.responses,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error };
  }
}

/**
 * Send a push notification to multiple users
 * 
 * @param userIds Array of user IDs to send notification to
 * @param title Notification title
 * @param body Notification body
 * @param data Additional data to send with notification
 * @returns Promise with the messaging results
 */
export async function sendPushNotificationToUsers(
  userIds: string[],
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    // Get all users' device tokens
    const deviceTokens = await prisma.deviceToken.findMany({
      where: {
        userId: { in: userIds },
        tokenType: 'fcm', // Only get FCM tokens
      },
      select: {
        token: true,
      },
    });

    if (!deviceTokens.length) {
      console.log(`No FCM tokens found for users ${userIds.join(', ')}`);
      return { success: false, message: 'No device tokens found' };
    }

    // Extract tokens
    const tokens = deviceTokens.map((dt) => dt.token);

    // Send notification
    const message = {
      notification: {
        title,
        body,
      },
      data: data || {},
      tokens,
    };

    const response = await admin.messaging().sendEachForMulticast(message);
    
    console.log(
      `Successfully sent notifications: ${response.successCount}/${tokens.length}`
    );
    
    return {
      success: true,
      successCount: response.successCount,
      failureCount: response.failureCount,
      results: response.responses,
    };
  } catch (error) {
    console.error('Error sending push notification:', error);
    return { success: false, error };
  }
}

/**
 * Send a push notification to all employees in a specific city
 * 
 * @param city City name
 * @param title Notification title
 * @param body Notification body
 * @param data Additional data to send with notification
 * @returns Promise with the messaging results
 */
export async function sendPushNotificationByCity(
  city: string,
  title: string,
  body: string,
  data?: Record<string, string>
) {
  try {
    // Get all employees in the city
    const employees = await prisma.employee.findMany({
      where: {
        city,
      },
      select: {
        userId: true,
      },
    });

    if (!employees.length) {
      console.log(`No employees found in city ${city}`);
      return { success: false, message: 'No employees found' };
    }

    const userIds = employees.map((emp) => emp.userId);
    
    // Use the existing function to send to multiple users
    return sendPushNotificationToUsers(userIds, title, body, data);
  } catch (error) {
    console.error('Error sending push notification by city:', error);
    return { success: false, error };
  }
}

export default admin; 