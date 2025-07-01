import { PrismaClient } from "@prisma/client";
import { sendPushNotificationToUser, sendPushNotificationToUsers } from './firebase-admin';
import prisma from './prisma';
import { validateActionUrl, isLikelyValidRoute } from './url-validator';

// 🚀 PRODUCTION: Retry configuration
const RETRY_CONFIG = {
  maxRetries: 3,
  baseDelay: 1000, // 1 second
  maxDelay: 30000, // 30 seconds
  backoffMultiplier: 2,
};

// 🚀 PRODUCTION: Rate limiting
const RATE_LIMITS = {
  maxNotificationsPerMinute: 60,
  maxNotificationsPerHour: 1000,
  maxNotificationsPerDay: 10000,
};

// 🚀 PRODUCTION: Delivery status tracking
export enum DeliveryStatus {
  PENDING = 'pending',
  SENT = 'sent',
  DELIVERED = 'delivered',
  FAILED = 'failed',
  RETRYING = 'retrying',
}

// 🚀 PRODUCTION: Notification priority levels
export enum NotificationPriority {
  LOW = 'low',
  NORMAL = 'normal',
  HIGH = 'high',
  URGENT = 'urgent',
}

// 🚀 PRODUCTION: Notification categories
export enum NotificationCategory {
  SYSTEM = 'system',
  BUSINESS = 'business',
  SECURITY = 'security',
  ATTENDANCE = 'attendance',
  SALES = 'sales',
  DOCUMENTS = 'documents',
  REPORTS = 'reports',
}

/**
 * 🚀 PRODUCTION: Enhanced notification service with delivery tracking, retry logic, and analytics
 */
export async function notifyUserOrEmployee({
  userId,
  employeeId,
  type,
  message,
  actionUrl,
  actionLabel,
  sessionToken,
  broadcastToAdmin,
  broadcastToEmployee,
  broadcastAll = false,
  skipRealtime = false,
  priority = NotificationPriority.NORMAL,
  category = NotificationCategory.BUSINESS,
  maxRetries = RETRY_CONFIG.maxRetries,
}: {
  userId?: string;
  employeeId?: number;
  type: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  sessionToken?: string;
  broadcastToAdmin?: boolean;
  broadcastToEmployee?: boolean;
  broadcastAll?: boolean;
  skipRealtime?: boolean;
  priority?: NotificationPriority;
  category?: NotificationCategory;
  maxRetries?: number;
}) {
  // 🚀 PRODUCTION: Rate limiting check
  if (!await checkRateLimit(userId, employeeId)) {
    console.warn(`[Notification] Rate limit exceeded for user ${userId || employeeId}`);
    return null;
  }

  // 1. If employeeId is provided but userId is not, fetch the employee's userId
  let finalUserId = userId;
  let employee = null;
  
  if (employeeId) {
    employee = await prisma.employee.findUnique({
      where: { id: employeeId },
      select: { userId: true, user: { select: { name: true, email: true } } }
    });
    
    if (employee && !finalUserId) {
      finalUserId = employee.userId;
    }
    
    // Safety check: If employeeId was provided but not found in the database
    if (!employee) {
      console.error(`[Notification] Cannot create notification: Employee ID ${employeeId} not found in database`);
      return null; // Skip notification creation
    }
  }
  
  // Safety check: Ensure we have either a valid userId or employeeId
  if (!finalUserId && !employeeId) {
    console.error("[Notification] Cannot create notification: Neither valid userId nor employeeId provided");
    return null; // Skip notification creation
  }

  // If userId is provided, verify it exists in the database
  if (finalUserId) {
    const userExists = await prisma.user.findUnique({
      where: { id: finalUserId },
      select: { id: true }
    });
    
    if (!userExists) {
      console.error(`[Notification] Cannot create notification: User ID ${finalUserId} not found in database`);
      return null; // Skip notification creation
    }
  }

  // 🚀 PRODUCTION: Validate and sanitize actionUrl
  let validatedActionUrl = actionUrl;
  if (actionUrl) {
    validatedActionUrl = validateActionUrl(actionUrl);
    
    // Log warning if URL looks suspicious
    if (!isLikelyValidRoute(validatedActionUrl)) {
      console.warn(`[Notification] Suspicious actionUrl detected: "${actionUrl}" -> "${validatedActionUrl}" for notification type: ${type}`);
    }
    
    // Log if URL was modified during validation
    if (validatedActionUrl !== actionUrl) {
      console.info(`[Notification] actionUrl sanitized: "${actionUrl}" -> "${validatedActionUrl}"`);
    }
  }

  // 2. Create notification in DB with enhanced tracking
  const notification = await prisma.notification.create({
    data: {
      userId: finalUserId,
      employeeId,
      type,
      message,
      actionUrl: validatedActionUrl,
      actionLabel,
      priority,
      category,
      deliveryStatus: DeliveryStatus.PENDING,
      maxRetries,
    },
  });

  // Skip real-time notification if requested (for better performance)
  if (skipRealtime || !notification) {
    return notification;
  }

  // Only log basic info to reduce console noise
  console.log(`[Notification] Created: type=${type}, employeeId=${employeeId}, priority=${priority}, category=${category}`);
  
  // Safety check: If notification creation failed, skip WebSocket notification
  if (!notification) {
    console.error("[Notification] Skipping WebSocket notification because DB notification creation failed");
    return null;
  }

  // 3. Check settings before sending real-time notification
  let settings = null;
  try {
    settings = await prisma.settings.findFirst({
      select: { adminRealtimeEnabled: true, employeeRealtimeEnabled: true }
    });
  } catch (err) {
    console.error("[Notification] Error fetching settings:", err);
  }
  
  if (
    (userId && settings?.adminRealtimeEnabled === false) ||
    (employeeId && settings?.employeeRealtimeEnabled === false)
  ) {
    return notification;
  }

  // 4. 🚀 PRODUCTION: Send real-time notification with retry logic
  await sendNotificationWithRetry(notification, {
    userId: finalUserId,
    employeeId,
    employee,
    sessionToken,
    broadcastToAdmin,
    broadcastToEmployee,
    broadcastAll,
  });

  return notification;
}

/**
 * 🚀 PRODUCTION: Send notification with exponential backoff retry logic
 */
async function sendNotificationWithRetry(
  notification: any,
  options: {
    userId?: string;
    employeeId?: number;
    employee?: any;
    sessionToken?: string;
    broadcastToAdmin?: boolean;
    broadcastToEmployee?: boolean;
    broadcastAll?: boolean;
  }
) {
  const { userId, employeeId, employee, sessionToken, broadcastToAdmin, broadcastToEmployee, broadcastAll } = options;
  
  const wsServerUrl = process.env.WS_SERVER_URL || process.env.NEXT_PUBLIC_WS_URL;
  if (!wsServerUrl || (!userId && !employeeId)) {
    return;
  }

  // Determine proper broadcast targets
  const isAdminAction = notification.type.startsWith('admin_');
  const shouldBroadcastToAdmin = broadcastToAdmin !== undefined ? broadcastToAdmin : true;
  const shouldBroadcastToEmployee = broadcastToEmployee !== undefined 
    ? broadcastToEmployee 
    : (isAdminAction && employeeId !== undefined) || broadcastAll;

  const broadcastData = {
    event: notification.type,
    data: {
      ...notification,
      broadcastTo: {
        admin: shouldBroadcastToAdmin,
        employee: shouldBroadcastToEmployee
      },
      broadcastAll,
      userId,
      employeeId,
      employeeName: employee?.user?.name,
      employeeEmail: employee?.user?.email
    },
    token: sessionToken || 'anonymous'
  };

  // 🚀 PRODUCTION: Retry logic with exponential backoff
  let attempt = 0;
  const maxAttempts = notification.maxRetries || RETRY_CONFIG.maxRetries;

  while (attempt < maxAttempts) {
    try {
      // Update notification status to retrying
      if (attempt > 0) {
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            deliveryStatus: DeliveryStatus.RETRYING,
            deliveryAttempts: attempt + 1,
            lastAttemptAt: new Date(),
          }
        });
      }

      const response = await fetch(`${wsServerUrl}/broadcast-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(broadcastData),
      });
      
      if (response.ok) {
        // 🚀 PRODUCTION: Mark as delivered
        await prisma.notification.update({
          where: { id: notification.id },
          data: {
            deliveryStatus: DeliveryStatus.DELIVERED,
            deliveredAt: new Date(),
            deliveryAttempts: attempt + 1,
            lastAttemptAt: new Date(),
          }
        });
        
        console.log(`[Notification] Successfully delivered notification ${notification.id} after ${attempt + 1} attempts`);
        return;
      } else {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
    } catch (err) {
      attempt++;
      console.error(`[Notification] Attempt ${attempt} failed for notification ${notification.id}:`, err);
      
      // 🚀 PRODUCTION: Update error information
      await prisma.notification.update({
        where: { id: notification.id },
        data: {
          deliveryStatus: attempt >= maxAttempts ? DeliveryStatus.FAILED : DeliveryStatus.RETRYING,
          deliveryAttempts: attempt,
          lastAttemptAt: new Date(),
          errorMessage: attempt >= maxAttempts ? err.message : undefined,
          failedAt: attempt >= maxAttempts ? new Date() : undefined,
        }
      });

      if (attempt >= maxAttempts) {
        console.error(`[Notification] All ${maxAttempts} attempts failed for notification ${notification.id}`);
        return;
      }

      // 🚀 PRODUCTION: Exponential backoff
      const delay = Math.min(
        RETRY_CONFIG.baseDelay * Math.pow(RETRY_CONFIG.backoffMultiplier, attempt - 1),
        RETRY_CONFIG.maxDelay
      );
      
      await new Promise(resolve => setTimeout(resolve, delay));
    }
  }
}

/**
 * 🚀 PRODUCTION: Rate limiting check
 */
async function checkRateLimit(userId?: string, employeeId?: number): Promise<boolean> {
  const now = new Date();
  const oneMinuteAgo = new Date(now.getTime() - 60 * 1000);
  const oneHourAgo = new Date(now.getTime() - 60 * 60 * 1000);
  const oneDayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const whereClause = {
    createdAt: { gte: oneMinuteAgo },
    ...(userId ? { userId } : {}),
    ...(employeeId ? { employeeId } : {}),
  };

  const [minuteCount, hourCount, dayCount] = await Promise.all([
    prisma.notification.count({ where: { ...whereClause, createdAt: { gte: oneMinuteAgo } } }),
    prisma.notification.count({ where: { ...whereClause, createdAt: { gte: oneHourAgo } } }),
    prisma.notification.count({ where: { ...whereClause, createdAt: { gte: oneDayAgo } } }),
  ]);

  return minuteCount < RATE_LIMITS.maxNotificationsPerMinute &&
         hourCount < RATE_LIMITS.maxNotificationsPerHour &&
         dayCount < RATE_LIMITS.maxNotificationsPerDay;
}

/**
 * 🚀 PRODUCTION: Track notification click/engagement
 */
export async function trackNotificationClick(notificationId: number) {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        clickedAt: new Date(),
        engagementScore: 0.5, // Basic engagement score
      }
    });
  } catch (error) {
    console.error('[Notification] Error tracking click:', error);
  }
}

/**
 * 🚀 PRODUCTION: Track notification action completion
 */
export async function trackNotificationAction(notificationId: number) {
  try {
    await prisma.notification.update({
      where: { id: notificationId },
      data: {
        actionCompletedAt: new Date(),
        engagementScore: 1.0, // Full engagement score
      }
    });
  } catch (error) {
    console.error('[Notification] Error tracking action completion:', error);
  }
}

/**
 * 🚀 PRODUCTION: Get notification analytics
 */
export async function getNotificationAnalytics(timeRange: 'day' | 'week' | 'month' = 'day') {
  const now = new Date();
  let startDate: Date;

  switch (timeRange) {
    case 'day':
      startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'week':
      startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    case 'month':
      startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      break;
  }

  const analytics = await prisma.notification.groupBy({
    by: ['deliveryStatus', 'type', 'category'],
    where: {
      createdAt: { gte: startDate }
    },
    _count: {
      id: true
    }
  });

  const totalNotifications = await prisma.notification.count({
    where: { createdAt: { gte: startDate } }
  });

  const deliveredNotifications = await prisma.notification.count({
    where: {
      createdAt: { gte: startDate },
      deliveryStatus: 'delivered'
    }
  });

  const failedNotifications = await prisma.notification.count({
    where: {
      createdAt: { gte: startDate },
      deliveryStatus: 'failed'
    }
  });

  const engagementRate = await prisma.notification.aggregate({
    where: {
      createdAt: { gte: startDate },
      clickedAt: { not: null }
    },
    _avg: {
      engagementScore: true
    }
  });

  return {
    total: totalNotifications,
    delivered: deliveredNotifications,
    failed: failedNotifications,
    deliveryRate: totalNotifications > 0 ? (deliveredNotifications / totalNotifications) * 100 : 0,
    failureRate: totalNotifications > 0 ? (failedNotifications / totalNotifications) * 100 : 0,
    averageEngagement: engagementRate._avg.engagementScore || 0,
    breakdown: analytics,
    timeRange
  };
}

/**
 * 🚀 PRODUCTION: Retry failed notifications
 */
export async function retryFailedNotifications() {
  const failedNotifications = await prisma.notification.findMany({
    where: {
      deliveryStatus: 'failed',
      retryCount: { lt: 3 }, // Max 3 retries
      createdAt: { gte: new Date(Date.now() - 24 * 60 * 60 * 1000) } // Only retry notifications from last 24 hours
    }
  });

  console.log(`[Notification] Retrying ${failedNotifications.length} failed notifications`);

  for (const notification of failedNotifications) {
    try {
      await sendNotificationWithRetry(notification, {
        userId: notification.userId,
        employeeId: notification.employeeId,
      });
    } catch (error) {
      console.error(`[Notification] Failed to retry notification ${notification.id}:`, error);
    }
  }
}

/**
 * 🚀 PRODUCTION: Clean up old notifications
 */
export async function cleanupOldNotifications(daysToKeep: number = 90) {
  const cutoffDate = new Date(Date.now() - daysToKeep * 24 * 60 * 60 * 1000);
  
  const result = await prisma.notification.deleteMany({
    where: {
      createdAt: { lt: cutoffDate },
      deliveryStatus: { in: ['delivered', 'failed'] }
    }
  });

  console.log(`[Notification] Cleaned up ${result.count} old notifications`);
  return result.count;
}

/**
 * Create a notification and send push notification if applicable
 * 
 * @param options Notification options
 * @returns Created notification
 */
export async function createNotificationWithPush({
  userId,
  employeeId,
  type,
  message,
  actionUrl,
  actionLabel,
  sendPush = true,
}: {
  userId?: string;
  employeeId?: number;
  type: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  sendPush?: boolean;
}) {
  try {
    // 🚀 PRODUCTION: Validate and sanitize actionUrl
    let validatedActionUrl = actionUrl;
    if (actionUrl) {
      validatedActionUrl = validateActionUrl(actionUrl);
      
      // Log warning if URL looks suspicious
      if (!isLikelyValidRoute(validatedActionUrl)) {
        console.warn(`[Notification] Suspicious actionUrl detected: "${actionUrl}" -> "${validatedActionUrl}" for notification type: ${type}`);
      }
      
      // Log if URL was modified during validation
      if (validatedActionUrl !== actionUrl) {
        console.info(`[Notification] actionUrl sanitized: "${actionUrl}" -> "${validatedActionUrl}"`);
      }
    }

    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        userId,
        employeeId,
        type,
        message,
        actionUrl: validatedActionUrl,
        actionLabel,
        read: false,
      },
    });

    // Send push notification if requested
    if (sendPush) {
      const pushData: Record<string, string> = {};
      
      // Add action URL if provided
      if (actionUrl) {
        pushData.actionUrl = actionUrl;
      }
      
      // Add action label if provided
      if (actionLabel) {
        pushData.actionLabel = actionLabel;
      }
      
      // Add notification ID for reference
      pushData.notificationId = notification.id.toString();
      
      // Send to specific user if userId is provided
      if (userId) {
        await sendPushNotificationToUser(
          userId,
          type, // Use notification type as title
          message,
          pushData
        );
      }
      
      // If we have an employeeId but no userId, fetch the userId first
      if (employeeId && !userId) {
        const employee = await prisma.employee.findUnique({
          where: { id: employeeId },
          select: { userId: true },
        });
        
        if (employee?.userId) {
          await sendPushNotificationToUser(
            employee.userId,
            type, // Use notification type as title
            message,
            pushData
          );
        }
      }
    }

    return notification;
  } catch (error) {
    console.error('Error creating notification with push:', error);
    throw error;
  }
}

/**
 * Create notifications for multiple users and send push notifications
 * 
 * @param options Notification options
 * @returns Created notifications
 */
export async function createBulkNotificationsWithPush({
  userIds,
  type,
  message,
  actionUrl,
  actionLabel,
  sendPush = true,
}: {
  userIds: string[];
  type: string;
  message: string;
  actionUrl?: string;
  actionLabel?: string;
  sendPush?: boolean;
}) {
  try {
    // 🚀 PRODUCTION: Validate and sanitize actionUrl
    let validatedActionUrl = actionUrl;
    if (actionUrl) {
      validatedActionUrl = validateActionUrl(actionUrl);
      
      // Log warning if URL looks suspicious
      if (!isLikelyValidRoute(validatedActionUrl)) {
        console.warn(`[Notification] Suspicious actionUrl detected: "${actionUrl}" -> "${validatedActionUrl}" for bulk notification type: ${type}`);
      }
      
      // Log if URL was modified during validation
      if (validatedActionUrl !== actionUrl) {
        console.info(`[Notification] actionUrl sanitized: "${actionUrl}" -> "${validatedActionUrl}"`);
      }
    }

    // Create notifications for all users
    const notifications = await prisma.$transaction(
      userIds.map((userId) =>
        prisma.notification.create({
          data: {
            userId,
            type,
            message,
            actionUrl: validatedActionUrl,
            actionLabel,
            read: false,
          },
        })
      )
    );

    // Send push notifications if requested
    if (sendPush) {
      const pushData: Record<string, string> = {};
      
      // Add action URL if provided
      if (actionUrl) {
        pushData.actionUrl = actionUrl;
      }
      
      // Add action label if provided
      if (actionLabel) {
        pushData.actionLabel = actionLabel;
      }
      
      // Send to all users at once
      await sendPushNotificationToUsers(
        userIds,
        type, // Use notification type as title
        message,
        pushData
      );
    }

    return notifications;
  } catch (error) {
    console.error('Error creating bulk notifications with push:', error);
    throw error;
  }
}

/**
 * Mark a notification as read
 * 
 * @param notificationId Notification ID
 * @returns Updated notification
 */
export async function markNotificationAsRead(notificationId: number) {
  try {
    return await prisma.notification.update({
      where: { id: notificationId },
      data: { read: true },
    });
  } catch (error) {
    console.error('Error marking notification as read:', error);
    throw error;
  }
}

/**
 * Mark all notifications as read for a user
 * 
 * @param userId User ID
 * @returns Count of updated notifications
 */
export async function markAllNotificationsAsRead(userId: string) {
  try {
    const result = await prisma.notification.updateMany({
      where: {
        userId,
        read: false,
      },
      data: {
        read: true,
      },
    });

    return result.count;
  } catch (error) {
    console.error('Error marking all notifications as read:', error);
    throw error;
  }
} 