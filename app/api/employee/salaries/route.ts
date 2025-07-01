import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// GET: Fetch salary records for the logged-in employee
export async function GET(req: NextRequest) {
  try {
    // Authenticate and ensure it's an employee (not admin)
    const auth = await requireAuth(req);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }
    
    const session = auth.session!;
    // Only allow non-admins (employees)
    if (session.user?.isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    
    const userId = (session.user as any)?.id;
    if (!userId) {
      return NextResponse.json({ error: 'User ID missing' }, { status: 400 });
    }

    // Find employee record
    const employee = await prisma.employee.findFirst({ where: { userId: userId } });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Robust pagination: sanitize and validate page/pageSize
    const url = new URL(req.url);
    let page = parseInt(url.searchParams.get("page") || "1", 10);
    let pageSize = parseInt(url.searchParams.get("pageSize") || "10", 10);
    if (isNaN(page) || page < 1) page = 1;
    if (isNaN(pageSize) || pageSize < 1) pageSize = 10;
    if (pageSize > 100) pageSize = 100;
    const skip = (page - 1) * pageSize;
    // Defensive: skip must never be negative
    if (skip < 0) {
      return NextResponse.json({ error: 'Invalid pagination parameters' }, { status: 400 });
    }

    // Date range filter
    const fromDate = url.searchParams.get("fromDate");
    const toDate = url.searchParams.get("toDate");
    let where: any = { employeeId: employee.id, deleted: false };
    if (fromDate || toDate) {
      where.payDate = {};
      if (fromDate) where.payDate.gte = new Date(fromDate);
      if (toDate) where.payDate.lte = new Date(toDate);
    }

    // Get total count for pagination
    const total = await prisma.salary.count({ where });

    // Get paginated salary records
    const salaries = await prisma.salary.findMany({
      where,
      orderBy: { payDate: 'desc' },
      skip,
      take: pageSize,
      include: {
        employee: {
          include: { user: true }
        }
      }
    });

    // Helper to build a breakdown string from metadata
    function buildBreakdown(metadata: any) {
      if (!metadata) return "No data available";
      return [
        `Base Salary: $${metadata.baseSalary ?? "-"}`,
        `Overtime Bonus: $${metadata.overtimeBonus ?? "-"}`,
        `Bonuses: $${metadata.bonuses ?? "-"}`,
        `Deductions: -$${metadata.deductions ?? "-"}`,
        `Total Amount: $${metadata.totalAmount ?? "-"}`
      ].join("\n");
    }

    // Get current month's salary (the most recent one)
    const currentSalary = await prisma.salary.findFirst({
      where: { 
        employeeId: employee.id,
        deleted: false
      },
      orderBy: { payDate: 'desc' },
      include: {
        employee: {
          include: { user: true }
        }
      }
    });

    // Add breakdowns
    const currentSalaryWithBreakdown = currentSalary
      ? { ...currentSalary, breakdown: buildBreakdown(currentSalary.metadata) }
      : null;

    const salariesWithBreakdown = salaries.map(sal => ({
      ...sal,
      breakdown: buildBreakdown(sal.metadata)
    }));

    return NextResponse.json({
      salaries: salariesWithBreakdown,
      currentSalary: currentSalaryWithBreakdown,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch employee salary records" },
      { status: 500 }
    );
  }
} 