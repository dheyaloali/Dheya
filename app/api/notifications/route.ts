import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(request: Request) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return new NextResponse("Unauthorized", { status: 401 });
    }

    const { searchParams } = new URL(request.url);
    const skip = parseInt(searchParams.get("skip") || "0");
    const take = parseInt(searchParams.get("take") || "20");

    console.log("[Notifications API] Session userId:", session.user.id);

    // Get the session token from the request headers
    const sessionToken = request.headers.get("x-session-token");

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
    return new NextResponse("Internal Server Error", { status: 500 });
  }
} 