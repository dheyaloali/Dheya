
import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";

export async function GET(
  request: NextRequest,
  context: { params: { id: string } }
) {
  const params = await context.params;
  const id = parseInt(params.id, 10);
  if (isNaN(id)) {
    return NextResponse.json({ error: "Invalid ID" }, { status: 400 });
  }

  try {
    const salary = await prisma.salary.findUnique({ where: { id } });
    if (!salary) {
      return NextResponse.json({ error: "Not found" }, { status: 404 });
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

    const { employeeId, startDate, endDate, amount: baseSalary } = salary as any;
    if (!employeeId || !startDate || !endDate) {
      return NextResponse.json({ error: "Missing period or employee info" }, { status: 400 });
    }
// Fetch employee name
const employee = await prisma.employee.findUnique({
  where: { id: employeeId },
  include: { user: true }
});
const employeeName = employee?.user?.name || "Unknown";
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
    const totalSalary =
      baseSalary + bonus + overtimeBonus - undertimeDeduction - absenceDeduction;

    return NextResponse.json({
        salaryId: id,
        employeeId,
        employeeName, // <-- add this line
        period: { startDate, endDate },
        baseSalary,
        totalWorkedHours,
        salesTotal,
        absentDays,
        bonus,
        overtimeBonus,
        undertimeDeduction,
        absenceDeduction,
        totalSalary,
        timeLogs,
        salesRecords,
        absenceRecords,
        auditLogs,
      });
  } catch (error) {
    console.error('Error in salary breakdown:', error);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}