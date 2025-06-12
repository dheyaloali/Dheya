import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import rateLimit from 'next-rate-limit';

const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500, // Max 500 unique IPs per minute
});

export async function GET(req: NextRequest) {
  try {
    await limiter.check(res, 100, 'CACHE_TOKEN'); // 100 requests per minute
  } catch {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }
  // Require admin authentication
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    // Total employees
    const totalEmployees = await prisma.employee.count();

    // Employee growth (new employees in the last 30 days)
    const now = new Date();
    const lastMonth = new Date(now);
    lastMonth.setMonth(now.getMonth() - 1);
    const employeeGrowth = await prisma.employee.count({
      where: {
        joinDate: { gte: lastMonth },
      },
    });

    // Today's attendance
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const attendanceToday = await prisma.attendance.count({
      where: {
        date: { gte: today },
      },
    });

    // Attendance rate (today's attendance / total employees)
    const attendanceRate = totalEmployees > 0 ? Math.round((attendanceToday / totalEmployees) * 100) : 0;

    // Total sales (use aggregate)
    const { _sum: { amount: totalSales = 0 } = {} } = await prisma.sale.aggregate({
      _sum: { amount: true }
    });

    // Sales growth (sales in last 30 days vs previous 30 days)
    const lastMonthSales = await prisma.sale.aggregate({
      _sum: { amount: true },
      where: { date: { gte: lastMonth } }
    });
    const prevMonth = new Date(lastMonth);
    prevMonth.setMonth(lastMonth.getMonth() - 1);
    const prevMonthSales = await prisma.sale.aggregate({
      _sum: { amount: true },
      where: { date: { gte: prevMonth, lt: lastMonth } }
    });
    const lastMonthTotal = lastMonthSales._sum.amount || 0;
    const prevMonthTotal = prevMonthSales._sum.amount || 0;
    const salesGrowth = prevMonthTotal > 0 ? Math.round(((lastMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) : 0;

    // Pending salaries (sum and count, not fetching all)
    const pendingSalariesAgg = await prisma.salary.aggregate({
      _sum: { amount: true },
      _count: { employeeId: true },
      where: { status: "pending", deleted: false }
    });
    const pendingSalaries = pendingSalariesAgg._sum.amount || 0;
    const pendingSalariesCount = pendingSalariesAgg._count.employeeId || 0;

    return NextResponse.json({
      totalEmployees,
      employeeGrowth,
      attendanceToday,
      attendanceRate,
      totalSales,
      salesGrowth,
      pendingSalaries,
      pendingSalariesCount,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
  }
} 