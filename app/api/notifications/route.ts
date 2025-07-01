import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';
import { validateActionUrl, isLikelyValidRoute } from '@/lib/url-validator';

export async function GET(request: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized", code: "SESSION_INVALID" }, { status: 401 });
    }
    
    // Enhanced validation: Check if user still exists in database
    const userExists = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true }
    });
    
    if (!userExists) {
      console.log(`[API] User ${session.user.id} no longer exists in database`);
      return NextResponse.json({ 
        error: 'Unauthorized', 
        code: 'SESSION_INVALID',
        message: 'User account no longer exists'
      }, { status: 401 });
    }

    console.log("[Notifications API] Session userId:", session.user.id);
    
    // Get the session token from the request headers
    const sessionToken = request.headers.get("x-session-token");
    
    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get("skip") || "0");
    const take = parseInt(searchParams.get("take") || "20");
    
    // Build the where clause based on user type
    let whereClause: any = {};
    
    if (session.user.isAdmin) {
      // For admin users, only show notifications for them or admin notifications
      whereClause = {
        OR: [
          { userId: session.user.id },
          { type: { startsWith: "admin_" } }
        ]
      };
    } else {
      // If user is employee, only show notifications for them
      const employee = await prisma.employee.findFirst({
        where: { userId: session.user.id }
      });
      whereClause = {
        OR: [
          { userId: session.user.id },
          ...(employee ? [{ employeeId: employee.id }] : [])
        ]
      };
    }

    console.log("[Notifications API] Prisma where filter:", whereClause);

    const notifications = await prisma.notification.findMany({
      where: whereClause,
      orderBy: { createdAt: "desc" },
      skip,
      take,
    });
    
    console.log("[Notifications API] Notifications found:", notifications.length);

    return NextResponse.json(notifications);
  } catch (error) {
    console.error("[Notifications API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}

// POST method to create notifications
export async function POST(request: NextRequest) {
  try {
    // For WebSocket server and internal API calls, we'll use a special header
    const internalApiKey = request.headers.get("x-internal-api-key");
    const isInternalCall = internalApiKey === process.env.INTERNAL_API_KEY;
    
    // If not an internal call, require authentication
    if (!isInternalCall) {
      const session = await getServerSession(authOptions);
      if (!session?.user?.id || !session.user.isAdmin) {
        return NextResponse.json({ error: "Unauthorized", code: "SESSION_INVALID" }, { status: 401 });
      }
      
      // Enhanced validation: Check if user still exists in database
      const userExists = await prisma.user.findUnique({
        where: { id: session.user.id },
        select: { id: true }
      });
      
      if (!userExists) {
        console.log(`[API] User ${session.user.id} no longer exists in database`);
        return NextResponse.json({ 
          error: 'Unauthorized', 
          code: 'SESSION_INVALID',
          message: 'User account no longer exists'
        }, { status: 401 });
      }
    }
    
    // Parse request body
    const body = await request.json();
    const { type, message, employeeId, userId, broadcastTo } = body;
    
    if (!type || !message) {
      return NextResponse.json({ error: "Missing required fields: type, message" }, { status: 400 });
    }
    
    // Determine target user ID based on employeeId if provided
    let targetUserId = userId;
    
    if (employeeId && !targetUserId) {
      // Look up the employee to get their userId
      const employee = await prisma.employee.findFirst({
        where: { id: parseInt(employeeId) },
        select: { userId: true }
      });
      
      if (employee) {
        targetUserId = employee.userId;
      }
    }
    
    // 🚀 PRODUCTION: Validate and sanitize actionUrl
    let validatedActionUrl = body.actionUrl;
    if (body.actionUrl) {
      validatedActionUrl = validateActionUrl(body.actionUrl);
      
      // Log warning if URL looks suspicious
      if (!isLikelyValidRoute(validatedActionUrl)) {
        console.warn(`[Notifications API] Suspicious actionUrl detected: "${body.actionUrl}" -> "${validatedActionUrl}" for notification type: ${type}`);
      }
      
      // Log if URL was modified during validation
      if (validatedActionUrl !== body.actionUrl) {
        console.info(`[Notifications API] actionUrl sanitized: "${body.actionUrl}" -> "${validatedActionUrl}"`);
      }
    }
    
    // Create notification in database
    const notification = await prisma.notification.create({
      data: {
        type,
        message,
        ...(targetUserId ? { userId: targetUserId } : {}),
        ...(employeeId ? { employeeId: parseInt(employeeId) } : {}),
        read: false,
        actionUrl: validatedActionUrl,
        actionLabel: body.actionLabel,
        createdAt: new Date(),
      }
    });
    
    console.log("[Notifications API] Created notification:", notification.id);
    
    // If this is a WebSocket server notification that should be broadcast in real-time
    if (broadcastTo && (broadcastTo.admin || broadcastTo.employee)) {
      // Get WebSocket server URL from env
      const wsServerUrl = process.env.NEXT_PUBLIC_WS_URL || 'http://localhost:3001';
      
      try {
        // Forward to WebSocket server for real-time broadcasting
        const response = await fetch(`${wsServerUrl}/broadcast-notification`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            data: {
              ...notification,
              broadcastTo
            }
          })
        });
        
        if (!response.ok) {
          console.error("[Notifications API] Failed to broadcast notification:", await response.text());
        }
      } catch (error) {
        console.error("[Notifications API] Error broadcasting notification:", error);
      }
    }
    
    return NextResponse.json(notification);
  } catch (error) {
    console.error("[Notifications API] Error creating notification:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 