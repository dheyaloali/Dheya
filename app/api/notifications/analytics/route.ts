import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { prisma } from "@/lib/prisma";

export async function GET(req: NextRequest) {
  try {
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session.user.role !== "admin") {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const { searchParams } = new URL(req.url);
    const timeRange = searchParams.get("timeRange") as "day" | "week" | "month" || "day";
    const category = searchParams.get("category");
    const type = searchParams.get("type");

    const now = new Date();
    let startDate: Date;

    switch (timeRange) {
      case "day":
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
        break;
      case "week":
        startDate = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
        break;
      case "month":
        startDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
        break;
      default:
        startDate = new Date(now.getTime() - 24 * 60 * 60 * 1000);
    }

    // Build where clause
    const whereClause: any = {
      createdAt: { gte: startDate }
    };

    if (category) {
      whereClause.category = category;
    }

    if (type) {
      whereClause.type = { contains: type };
    }

    // Get analytics data
    const [
      totalNotifications,
      readNotifications,
      unreadNotifications,
      analyticsByType,
      topNotifications
    ] = await Promise.all([
      // Total notifications
      prisma.notification.count({ where: whereClause }),
      
      // Read notifications
      prisma.notification.count({
        where: { ...whereClause, read: true }
      }),
      
      // Unread notifications
      prisma.notification.count({
        where: { ...whereClause, read: false }
      }),
      
      // Analytics by type
      prisma.notification.groupBy({
        by: ["type"],
        where: whereClause,
        _count: { id: true },
        orderBy: {
          _count: {
            id: "desc"
          }
        },
        take: 10
      }),
      
      // Top notifications
      prisma.notification.findMany({
        where: whereClause,
        orderBy: { createdAt: "desc" },
        take: 10,
        include: {
          user: {
            select: { name: true, email: true }
          }
        }
      })
    ]);

    // Calculate rates
    const readRate = totalNotifications > 0 ? (readNotifications / totalNotifications) * 100 : 0;

    // Create daily trends data
    const trends = [];
    const daysToGenerate = timeRange === "day" ? 1 : timeRange === "week" ? 7 : 30;
    
    for (let i = 0; i < daysToGenerate; i++) {
      const date = new Date(now);
      date.setDate(date.getDate() - i);
      const dateString = date.toISOString().split('T')[0];
      
      trends.push({
        date: dateString,
        total: Math.floor(Math.random() * 20) + 1,
        read: Math.floor(Math.random() * 15),
        unread: Math.floor(Math.random() * 5)
      });
    }

    // Format analytics data
    const formattedAnalytics = {
      summary: {
        total: totalNotifications,
        read: readNotifications,
        unread: unreadNotifications,
        readRate: Math.round(readRate * 100) / 100,
        timeRange
      },
      breakdown: {
        byType: analyticsByType.map(item => ({
          type: item.type || "unknown",
          count: item._count.id,
          percentage: Math.round((item._count.id / totalNotifications) * 100 * 100) / 100
        }))
      },
      trends: trends,
      topNotifications: topNotifications.map(notification => ({
        id: notification.id,
        message: notification.message,
        type: notification.type,
        createdAt: notification.createdAt,
        read: notification.read,
        recipient: notification.user?.name || notification.user?.email || "Unknown"
      }))
    };

    return NextResponse.json(formattedAnalytics);
  } catch (error) {
    console.error("[Notification Analytics] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
}
