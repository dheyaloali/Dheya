import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

const STANDARD_HOURS = 160;
const HOURLY_RATE = 12.5;
const OVERTIME_RATE = 20;
const UNDERTIME_DEDUCTION = 15;
const ABSENCE_DEDUCTION = 50;
const SALES_BONUS_PERCENT = 0.05;

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const { employeeId } = await req.json();
  if (!employeeId) {
    return NextResponse.json({ error: "employeeId is required" }, { status: 400 });
  }

  // Convert employeeId to integer
  const employeeIdInt = parseInt(employeeId, 10);
  if (isNaN(employeeIdInt)) {
    return NextResponse.json({ error: "Invalid employeeId format" }, { status: 400 });
  }

  const now = new Date();
  const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);
  const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0);

  // Check if already paid
  const existingSalary = await prisma.salary.findFirst({
    where: {
      employeeId: employeeIdInt,
      payDate: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
      status: "paid",
    },
  });

  // Fetch attendance
  const attendanceRecords = await prisma.attendance.findMany({
    where: {
      employeeId: employeeIdInt,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });
  const absentDays = attendanceRecords.filter(a => a.status?.toLowerCase() === "absent").length;
  const totalWorkedHours = attendanceRecords.reduce((sum, a) => sum + (parseFloat(a.workHours ? String(a.workHours) : '0') || 0), 0);
  const overtimeHours = Math.max(0, totalWorkedHours - STANDARD_HOURS);
  const undertimeHours = Math.max(0, STANDARD_HOURS - totalWorkedHours);

  // Fetch sales
  const salesRecords = await prisma.sale.findMany({
    where: {
      employeeId: employeeIdInt,
      date: {
        gte: startOfMonth,
        lte: endOfMonth,
      },
    },
  });
  const salesTotal = salesRecords.reduce((sum, s) => sum + s.amount, 0);

  // Calculate salary
  const baseSalary = STANDARD_HOURS * HOURLY_RATE;
  const bonus = salesTotal * SALES_BONUS_PERCENT;
  const overtimeBonus = overtimeHours * OVERTIME_RATE;
  const undertimeDeduction = undertimeHours * UNDERTIME_DEDUCTION;
  const absenceDeduction = absentDays * ABSENCE_DEDUCTION;
  const totalSalary = baseSalary + bonus + overtimeBonus - undertimeDeduction - absenceDeduction;

  return NextResponse.json({
    employeeId: employeeIdInt,
    baseSalary,
    salesTotal,
    bonus,
    totalWorkedHours,
    overtimeHours,
    overtimeBonus,
    undertimeHours,
    undertimeDeduction,
    absentDays,
    absenceDeduction,
    totalSalary,
    salaryRecord: existingSalary || null,
  });
} 