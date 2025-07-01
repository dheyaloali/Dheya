import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  // Require admin authentication
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  // Prepare date objects
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  try {
    // Run only the most critical queries in parallel
    const [totalEmployees, attendanceToday] = await Promise.all([
      // Total employees
      prisma.employee.count().catch((err: unknown) => {
        return 0;
      }),

      // Today's attendance
      prisma.attendance.count({
        where: { date: { gte: today } },
      }).catch((err: unknown) => {
        return 0;
      })
    ]);

    // Return minimal stats with aggressive caching
    return NextResponse.json({
      totalEmployees,
      attendanceToday
    }, { 
      headers: { 
        'Cache-Control': 'private, max-age=30, stale-while-revalidate=60' 
      } 
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch minimal dashboard stats" },
      { status: 500 }
    );
  }
} 