import { sendPushNotificationToUser } from './firebase-admin';

/**
 * Send a test push notification to a specific user
 * 
 * @param userId User ID to send notification to
 * @returns Result of the push notification attempt
 */
export async function sendTestPushNotification(userId: string) {
  try {
    const result = await sendPushNotificationToUser(
      userId,
      'Test Notification',
      'This is a test push notification from the Employee Management System',
      {
        actionUrl: '/employee/dashboard',
        actionLabel: 'Open Dashboard',
        testId: Date.now().toString(),
      }
    );

    console.log('Push notification test result:', result);
    return result;
  } catch (error) {
    console.error('Error sending test push notification:', error);
    throw error;
  }
}

/**
 * Create a notification in the database and send a push notification
 * 
 * @param userId User ID to send notification to
 * @returns Created notification
 */
export async function createTestNotificationWithPush(userId: string) {
  // Import dynamically to avoid circular dependencies
  const { createNotificationWithPush } = await import('./notifications');
  
  try {
    const notification = await createNotificationWithPush({
      userId,
      type: 'test_notification',
      message: 'This is a test notification with push',
      actionUrl: '/employee/dashboard',
      actionLabel: 'View Dashboard',
      sendPush: true,
    });

    console.log('Test notification created:', notification);
    return notification;
  } catch (error) {
    console.error('Error creating test notification with push:', error);
    throw error;
  }
} 