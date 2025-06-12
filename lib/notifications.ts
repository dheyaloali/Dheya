import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

/**
 * Notify a user (admin) or employee of an event.
 *
 * @param options - Notification options
 * @param options.userId - Admin user ID (string)
 * @param options.employeeId - Employee ID (number)
 * @param options.type - Notification type (string)
 * @param options.message - Notification message (string)
 * @param options.actionUrl - Optional action URL
 * @param options.actionLabel - Optional action label
 * @param options.sessionToken - Optional session token for WebSocket notification
 * @param options.broadcastToAdmin - Override whether to send to admins (default: true)
 * @param options.broadcastToEmployee - Override whether to send to employees (default: based on type)
 * @param options.broadcastAll - Whether to broadcast to all connected clients (default: false)
 * @param options.skipRealtime - Skip real-time notification (faster for non-critical notifications)
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
}) {
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

  // 2. Create notification in DB
  const notification = await prisma.notification.create({
    data: {
      userId: finalUserId,
      employeeId,
      type,
      message,
      actionUrl,
      actionLabel,
    },
  });

  // Skip real-time notification if requested (for better performance)
  if (skipRealtime || !notification) {
    return notification;
  }

  // Only log basic info to reduce console noise
  console.log(`[Notification] Created: type=${type}, employeeId=${employeeId}, skipRealtime=${skipRealtime}`);
  
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

  // 4. Send real-time notification via ws-server
  const wsServerUrl = process.env.WS_SERVER_URL || process.env.NEXT_PUBLIC_WS_URL;
  if (wsServerUrl && (userId || employeeId)) {
    // Determine proper broadcast targets
    const isAdminAction = type.startsWith('admin_');
    const shouldBroadcastToAdmin = broadcastToAdmin !== undefined ? broadcastToAdmin : true;
    const shouldBroadcastToEmployee = broadcastToEmployee !== undefined 
      ? broadcastToEmployee 
      : (isAdminAction && employeeId !== undefined) || broadcastAll;

    const broadcastData = {
      event: type,
      data: {
        ...notification,
        broadcastTo: {
          admin: shouldBroadcastToAdmin,
          employee: shouldBroadcastToEmployee
        },
        broadcastAll,
        userId: finalUserId,
        employeeId,
        employeeName: employee?.user?.name,
        employeeEmail: employee?.user?.email
      },
      token: sessionToken || 'anonymous'
    };

    // Try only once for performance
    try {
      const response = await fetch(`${wsServerUrl}/broadcast-notification`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(broadcastData),
      });
      
      if (!response.ok) {
        console.error(`[Notification] HTTP error! status: ${response.status}`);
      }
    } catch (err) {
      console.error("[Notification] Real-time delivery failed:", err);
    }
  }

  return notification;
} 