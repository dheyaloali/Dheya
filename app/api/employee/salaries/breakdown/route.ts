import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

// GET: Fetch a salary breakdown for the logged-in employee
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
    const employee = await prisma.employee.findFirst({
      where: { userId },
      select: { id: true }
    });

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }

    // Get the salary ID from query parameters
    const { searchParams } = new URL(req.url);
    const salaryId = searchParams.get('id');
    if (!salaryId) {
      return NextResponse.json({ error: 'Salary ID is required' }, { status: 400 });
    }

    // Parse salary ID
    const id = parseInt(salaryId, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: 'Invalid salary ID format' }, { status: 400 });
    }

    // Get the salary record, ensuring it belongs to the authenticated employee
    const salary = await prisma.salary.findFirst({
      where: {
        id,
        employeeId: employee.id,
        deleted: false
      }
    });

    if (!salary) {
      return NextResponse.json({ error: 'Salary record not found' }, { status: 404 });
    }

    // Re-use the existing breakdown endpoint logic but with security check
    const { employeeId, startDate, endDate, amount: baseSalary } = salary as any;
    if (!employeeId || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing period or employee info" }, { status: 400 });
    }

    // Find all related salary IDs (original + corrections)
    let salaryIds = [id];
    let current = salary;
    while (current && current.correctionOf) {
      salaryIds.push(current.correctionOf);
      current = await prisma.salary.findUnique({ where: { id: current.correctionOf } });
    }

    // Fetch audit log entries for all related salary IDs
    const auditLogs = await prisma.salaryAuditLog.findMany({
      where: { salaryId: { in: salaryIds } },
      orderBy: { changedAt: 'asc' }
    });

    // Get employee name
    const employeeData = await prisma.employee.findUnique({
      where: { id: employeeId },
      include: { user: true }
    });
    const employeeName = employeeData?.user?.name || "Unknown";

    // Fetch raw event data for the period
    const [timeLogs, salesRecords, absenceRecords] = await Promise.all([
      prisma.timeLog.findMany({
        where: {
          employeeId,
          date: { gte: startDate, lte: endDate },
        },
      }),
      prisma.salesRecord.findMany({
        where: {
          employeeId,
          date: { gte: startDate, lte: endDate },
        },
      }),
      prisma.absenceRecord.findMany({
        where: {
          employeeId,
          date: { gte: startDate, lte: endDate },
        },
      }),
    ]);

    // Aggregate breakdown
    const totalWorkedHours = (timeLogs as any[]).reduce((sum, log) => sum + (log.hours || 0), 0);
    const salesTotal = (salesRecords as any[]).reduce((sum, rec) => sum + (rec.amount || 0), 0);
    const absentDays = (absenceRecords as any[]).reduce((sum, rec) => sum + (rec.duration || 0), 0);

    // Business logic
    const STANDARD_HOURS = 160;
    const OVERTIME_RATE = 20;
    const UNDERTIME_DEDUCTION = 15;
    const ABSENCE_DEDUCTION = 50;
    const BONUS_PERCENT = 0.05; // 5%

    const overtimeHours = Math.max(0, totalWorkedHours - STANDARD_HOURS);
    const undertimeHours = Math.max(0, STANDARD_HOURS - totalWorkedHours);
    const bonus = salesTotal * BONUS_PERCENT;
    const overtimeBonus = overtimeHours * OVERTIME_RATE;
    const undertimeDeduction = undertimeHours * UNDERTIME_DEDUCTION;
    const absenceDeduction = absentDays * ABSENCE_DEDUCTION;
    const totalSalary = baseSalary + bonus + overtimeBonus - undertimeDeduction - absenceDeduction;

    return NextResponse.json({
      salaryId: id,
      employeeId,
      employeeName,
      period: { startDate, endDate },
      baseSalary,
      totalWorkedHours,
      salesTotal,
      absentDays,
      bonus,
      overtimeBonus,
      undertimeHours,
      overtimeHours,
      undertimeDeduction,
      absenceDeduction,
      totalSalary,
      auditLogs,
    });

  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch salary breakdown" },
      { status: 500 }
    );
  }
} 