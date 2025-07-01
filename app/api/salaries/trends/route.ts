import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(req: import('next/server').NextRequest) {
  try {
    const auth = await requireAuth(req, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    // Parse query params
    const { searchParams } = new URL(req.url);
    const groupBy = searchParams.get("groupBy") || "month"; // 'month' or 'year'
    const department = searchParams.get("department") || undefined;
    const city = searchParams.get("city") || undefined;
    const status = searchParams.get("status") || undefined;
    const start = searchParams.get("start") ? new Date(searchParams.get("start")!) : new Date(new Date().getFullYear(), new Date().getMonth() - 11, 1);
    const end = searchParams.get("end") ? new Date(searchParams.get("end")!) : new Date();

    // Fetch salaries with employee info for filtering
    const salaries = await prisma.salary.findMany({
      where: {
        AND: [
          {
            payDate: {
              gte: start,
              lte: end,
            },
          },
          {
            deleted: false,
          },
        ],
      },
      include: {
        employee: {
          include: {
            user: true,
          },
        },
      },
    });

    // Filter by department, city, status if provided
    const filtered = salaries.filter(s => {
      if (department && s.employee?.position?.toLowerCase() !== department.toLowerCase()) return false;
      if (city && s.employee?.city?.toLowerCase() !== city.toLowerCase()) return false;
      if (status && s.employee?.status?.toLowerCase() !== status.toLowerCase()) return false;
      return true;
    });

    // Aggregate by year or year-month
    const trends: Record<string, number> = {};
    for (const salary of filtered) {
      if (!salary.payDate) continue; // Skip salaries without payDate
      const date = new Date(salary.payDate);
      let key = "";
      if (groupBy === "year") {
        key = `${date.getFullYear()}`;
      } else {
        key = `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
      }
      trends[key] = (trends[key] || 0) + (salary.amount || 0);
    }

    // Convert to array for charting
    const result = Object.entries(trends).map(([period, amount]) => ({
      period,
      amount,
    }));

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 