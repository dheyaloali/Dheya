import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(req: import('next/server').NextRequest) {
  try {
    const auth = await requireAuth(req, true);
    
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    const url = new URL(req.url);
    const page = parseInt(url.searchParams.get("page") || "1", 10);
    const pageSize = parseInt(url.searchParams.get("pageSize") || "50", 10);
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

    // Fetch all employees with user info
    const employees = await prisma.employee.findMany({
      include: { user: true },
    });

    if (!employees || employees.length === 0) {
      return NextResponse.json({ error: "No employees found" }, { status: 404 });
    }

    // Fetch all current month salaries
    const salaries = await prisma.salary.findMany({
      where: {
        AND: [
          {
            payDate: {
              gte: startOfMonth,
              lte: endOfMonth,
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

    // Merge employees and salaries
    const salariesByEmployeeId = Object.fromEntries(salaries.map(s => [s.employeeId, s]));
    const currentMonthSalaries = employees.map(emp => {
      const salary = salariesByEmployeeId[emp.id];
      return {
        id: salary?.id || null,
        employeeId: emp.id,
        amount: salary?.amount || 0,
        status: salary?.status || "not paid",
        payDate: salary?.payDate || null,
        startDate: startOfMonth,
        endDate: endOfMonth,
        employee: emp,
        deleted: salary?.deleted || false,
        createdAt: salary?.createdAt || new Date(),
        updatedAt: salary?.updatedAt || new Date(),
      };
    });

    // Pagination
    const total = currentMonthSalaries.length;
    const paginatedSalaries = currentMonthSalaries.slice(skip, skip + take);

    // --- Calculate summary statistics for the WHOLE month (not just the page) ---
    const totalAmount = currentMonthSalaries.reduce((sum: number, s: any) => sum + s.amount, 0);
    const averageSalary = currentMonthSalaries.length > 0 ? totalAmount / currentMonthSalaries.length : 0;
    const highestSalary = Math.max(...currentMonthSalaries.map(s => s.amount || 0), 0);
    const statusCounts = currentMonthSalaries.reduce((acc: Record<string, number>, s: any) => {
      acc[s.status] = (acc[s.status] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);
    const paidSalaries = currentMonthSalaries.filter(
      s => s.status === "paid" && !Boolean(s.deleted) && s.amount > 0
    );
    const uniquePaidEmployeeIds = new Set(paidSalaries.map(s => s.employeeId));
    const employeesPaid = uniquePaidEmployeeIds.size;

    const summary = {
      totalAmount,
      averageSalary,
      employeeCount: currentMonthSalaries.length,
      highestSalary,
      statusDistribution: statusCounts,
      salaries: paginatedSalaries, // Only return the current page
      employeesPaid,
      total, // total count for pagination
      page,
      pageSize,
    };

    return NextResponse.json(summary);
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'An unexpected error occurred' },
      { status: 500 }
    );
  }
} 