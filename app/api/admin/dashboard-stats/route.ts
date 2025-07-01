import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Create a rate limiter instance
const limiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per 1 minute
});

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting based on IP
    await limiter.consume(req.ip || 'anonymous');
  } catch {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Require admin authentication
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  // Prepare date objects once to reuse
  const now = new Date();
  const lastMonth = new Date(now);
  lastMonth.setMonth(now.getMonth() - 1);
  const prevMonth = new Date(lastMonth);
  prevMonth.setMonth(lastMonth.getMonth() - 1);
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);

  // Response object to collect results
  const stats = {
    totalEmployees: 0,
    employeeGrowth: 0,
    attendanceToday: 0,
    attendanceRate: 0,
    totalSales: 0,
    salesGrowth: 0,
    pendingSalaries: 0,
    pendingSalariesCount: 0,
  };

  try {
    // Run independent queries in parallel for better performance
    const [
      totalEmployees,
      newEmployees,
      attendanceToday,
      salesData,
      lastMonthSales,
      prevMonthSales,
      pendingSalariesData
    ] = await Promise.all([
    // Total employees
      prisma.employee.count().catch((err: unknown) => {
        return 0;
      }),

    // Employee growth (new employees in the last 30 days)
      prisma.employee.count({
        where: { joinDate: { gte: lastMonth } },
      }).catch((err: unknown) => {
        return 0;
      }),

    // Today's attendance
      prisma.attendance.count({
        where: { date: { gte: today } },
      }).catch((err: unknown) => {
        return 0;
      }),

      // Total sales
      prisma.sale.aggregate({
      _sum: { amount: true }
      }).catch((err: unknown) => {
        return { _sum: { amount: 0 } };
      }),

      // Last month sales
      prisma.sale.aggregate({
      _sum: { amount: true },
      where: { date: { gte: lastMonth } }
      }).catch((err: unknown) => {
        return { _sum: { amount: 0 } };
      }),

      // Previous month sales
      prisma.sale.aggregate({
      _sum: { amount: true },
      where: { date: { gte: prevMonth, lt: lastMonth } }
      }).catch((err: unknown) => {
        return { _sum: { amount: 0 } };
      }),

      // Pending salaries
      prisma.salary.aggregate({
        where: { status: "pending", deleted: false },
        _sum: { amount: true },
        _count: { employeeId: true },
      }).catch((err: unknown) => {
        return { _sum: { amount: 0 }, _count: { employeeId: 0 } };
      })
    ]);

    // Process the results
    stats.totalEmployees = totalEmployees;
    stats.employeeGrowth = newEmployees;
    stats.attendanceToday = attendanceToday;
    stats.attendanceRate = totalEmployees > 0 ? Math.round((attendanceToday / totalEmployees) * 100) : 0;
    stats.totalSales = salesData._sum.amount || 0;
    
    const lastMonthTotal = lastMonthSales._sum.amount || 0;
    const prevMonthTotal = prevMonthSales._sum.amount || 0;
    stats.salesGrowth = prevMonthTotal > 0 
      ? Math.round(((lastMonthTotal - prevMonthTotal) / prevMonthTotal) * 100) 
      : 0;

    stats.pendingSalaries = pendingSalariesData._sum.amount || 0;
    stats.pendingSalariesCount = pendingSalariesData._count.employeeId || 0;

    // Return the stats with caching headers for better performance
    return NextResponse.json(stats, { 
      headers: { 
        // Allow 5 second browser caching, but validate on the server again after that
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=30' 
      } 
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch dashboard stats" },
      { status: 500 }
    );
  }
} 