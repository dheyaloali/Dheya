import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { notifyUserOrEmployee } from "@/lib/notifications";

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

  const body = await req.json();
  const { employeeId, baseSalary, bonusPercent, overtimeRate, undertimeDeduction, absenceDeduction, salesTotal, totalWorkedHours, absentDays } = body;
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
  if (existingSalary) {
    return NextResponse.json({ error: "Salary already paid for this month." }, { status: 409 });
  }

  // Fetch attendance and sales as fallback/calculation if needed
  let fallbackAbsentDays = 0;
  let fallbackTotalWorkedHours = 0;
  let fallbackSalesTotal = 0;
  if (
    absentDays === undefined ||
    totalWorkedHours === undefined ||
    salesTotal === undefined
  ) {
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
    fallbackAbsentDays = attendanceRecords.filter(a => a.status?.toLowerCase() === "absent").length;
    fallbackTotalWorkedHours = attendanceRecords.reduce((sum, a) => sum + (parseFloat(a.workHours ? String(a.workHours) : '0') || 0), 0);
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
    fallbackSalesTotal = salesRecords.reduce((sum, s) => sum + s.amount, 0);
  }

  // Use provided or fallback values
  const usedBaseSalary = baseSalary !== undefined ? baseSalary : STANDARD_HOURS * HOURLY_RATE;
  const usedBonusPercent = bonusPercent !== undefined ? bonusPercent : 5;
  const usedOvertimeRate = overtimeRate !== undefined ? overtimeRate : OVERTIME_RATE;
  const usedUndertimeDeduction = undertimeDeduction !== undefined ? undertimeDeduction : UNDERTIME_DEDUCTION;
  const usedAbsenceDeduction = absenceDeduction !== undefined ? absenceDeduction : ABSENCE_DEDUCTION;
  const usedSalesTotal = salesTotal !== undefined ? salesTotal : fallbackSalesTotal;
  const usedTotalWorkedHours = totalWorkedHours !== undefined ? totalWorkedHours : fallbackTotalWorkedHours;
  const usedAbsentDays = absentDays !== undefined ? absentDays : fallbackAbsentDays;

  // Validation for editable fields
  const validationErrors = [];
  if (baseSalary !== undefined && (typeof baseSalary !== 'number' || baseSalary < 0)) validationErrors.push('Base salary must be a non-negative number.');
  if (bonusPercent !== undefined && (typeof bonusPercent !== 'number' || bonusPercent < 0 || bonusPercent > 100)) validationErrors.push('Bonus percent must be between 0 and 100.');
  if (overtimeRate !== undefined && (typeof overtimeRate !== 'number' || overtimeRate < 0)) validationErrors.push('Overtime rate must be a non-negative number.');
  if (undertimeDeduction !== undefined && (typeof undertimeDeduction !== 'number' || undertimeDeduction < 0)) validationErrors.push('Undertime deduction must be a non-negative number.');
  if (absenceDeduction !== undefined && (typeof absenceDeduction !== 'number' || absenceDeduction < 0)) validationErrors.push('Absence deduction must be a non-negative number.');
  if (salesTotal !== undefined && (typeof salesTotal !== 'number' || salesTotal < 0)) validationErrors.push('Sales total must be a non-negative number.');
  if (totalWorkedHours !== undefined && (typeof totalWorkedHours !== 'number' || totalWorkedHours < 0)) validationErrors.push('Total worked hours must be a non-negative number.');
  if (absentDays !== undefined && (typeof absentDays !== 'number' || absentDays < 0)) validationErrors.push('Absent days must be a non-negative number.');
  if (validationErrors.length > 0) {
    return NextResponse.json({ error: validationErrors.join(' ') }, { status: 400 });
  }

  const overtimeHours = Math.max(0, usedTotalWorkedHours - STANDARD_HOURS);
  const undertimeHours = Math.max(0, STANDARD_HOURS - usedTotalWorkedHours);
  const bonus = usedSalesTotal * (usedBonusPercent / 100);
  const overtimeBonus = overtimeHours * usedOvertimeRate;
  const undertimeDeductionTotal = undertimeHours * usedUndertimeDeduction;
  const absenceDeductionTotal = usedAbsentDays * usedAbsenceDeduction;
  const totalSalary = usedBaseSalary + bonus + overtimeBonus - undertimeDeductionTotal - absenceDeductionTotal;

  // Prevent negative salary
  if (totalSalary < 0) {
    return NextResponse.json({ error: 'Total salary cannot be negative. Please review the input values.' }, { status: 400 });
  }

  // Save calculation breakdown
  const breakdown = {
    baseSalary: usedBaseSalary,
    salesTotal: usedSalesTotal,
    bonusPercent: usedBonusPercent,
    totalWorkedHours: usedTotalWorkedHours,
    overtimeRate: usedOvertimeRate,
    undertimeDeduction: usedUndertimeDeduction,
    absenceDeduction: usedAbsenceDeduction,
    absentDays: usedAbsentDays,
  };

  // Use transaction for database operations
  const salary = await prisma.$transaction(async (tx) => {
    // Create salary record
    const createdSalary = await tx.salary.create({
      data: {
        employeeId: employeeIdInt,
        amount: totalSalary,
        status: "paid",
        payDate: startOfMonth,
        startDate: startOfMonth,
        endDate: endOfMonth,
        metadata: breakdown, // Store the breakdown in metadata instead of as a separate field
      },
    });
    
    // Audit log: log salary creation
    await tx.salaryAuditLog.create({
      data: {
        salaryId: createdSalary.id,
        action: 'create',
        oldValue: undefined, // <-- use undefined, not null
        newValue: createdSalary,
        changedBy: auth.session?.user?.email ?? 'admin',
      }
    });
    
    return createdSalary;
  });

  // Get employee and admin info for notifications - do this outside transaction
  const employee = await prisma.employee.findUnique({
    where: { id: employeeIdInt },
    include: { user: true }
  });
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });

  // Notify employee
  if (employee) {
    try {
      await notifyUserOrEmployee({
        employeeId: employee.id,
        type: "employee_salary_created",
        message: `Your salary for ${startOfMonth.toLocaleDateString()} has been processed. Amount: $${totalSalary.toLocaleString()}`,
        actionUrl: "/employee/salary",
        actionLabel: "View Salary",
        broadcastToEmployee: true,
        skipRealtime: true // Add skipRealtime flag to avoid errors when WS server is down
      });
    } catch (notifyErr) {
      // Empty catch block
    }
  }

  // Notify admin
  if (admin) {
    try {
      await notifyUserOrEmployee({
        userId: admin.id,
        type: "admin_salary_created",
        message: `Salary processed for ${employee?.user?.name || employee?.user?.email}: $${totalSalary.toLocaleString()} for ${startOfMonth.toLocaleDateString()}`,
        actionUrl: `/admin/salaries`,
        actionLabel: "View Salaries",
        broadcastToAdmin: true,
        skipRealtime: true // Add skipRealtime flag to avoid errors when WS server is down
      });
    } catch (notifyErr) {
      // Empty catch block
    }
  }

  return NextResponse.json({
    employeeId,
    baseSalary: usedBaseSalary,
    salesTotal: usedSalesTotal,
    bonus,
    totalWorkedHours: usedTotalWorkedHours,
    overtimeHours,
    overtimeBonus,
    undertimeHours,
    undertimeDeduction: undertimeDeductionTotal,
    absentDays: usedAbsentDays,
    absenceDeduction: absenceDeductionTotal,
    totalSalary,
    salaryRecord: salary,
  });
} 