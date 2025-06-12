import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { notifyUserOrEmployee } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  const body = await req.json();
  const { salaryId, baseSalary, bonusPercent, overtimeRate, undertimeDeduction, absenceDeduction, salesTotal, totalWorkedHours, absentDays } = body;
  if (!salaryId) {
    return NextResponse.json({ error: "salaryId is required" }, { status: 400 });
  }

  // Convert salaryId to integer
  const salaryIdInt = parseInt(salaryId, 10);
  if (isNaN(salaryIdInt)) {
    return NextResponse.json({ error: "Invalid salaryId format" }, { status: 400 });
  }

  // Fetch original salary
  const originalSalary = await prisma.salary.findUnique({
    where: { id: salaryIdInt },
    include: { employee: { include: { user: true } } }
  });
  if (!originalSalary) {
    return NextResponse.json({ error: "Salary not found" }, { status: 404 });
  }
  if (originalSalary.status === "corrected") {
    return NextResponse.json({ error: "This salary has already been corrected." }, { status: 409 });
  }
  // Validation (reuse from process endpoint)
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
    console.error('Salary correction validation error:', validationErrors);
    return NextResponse.json({ error: validationErrors.join(' ') }, { status: 400 });
  }
  // Calculate new salary
  const STANDARD_HOURS = 160;
  const overtimeHours = Math.max(0, totalWorkedHours - STANDARD_HOURS);
  const undertimeHours = Math.max(0, STANDARD_HOURS - totalWorkedHours);
  const bonus = salesTotal * (bonusPercent / 100);
  const overtimeBonus = overtimeHours * overtimeRate;
  const undertimeDeductionTotal = undertimeHours * undertimeDeduction;
  const absenceDeductionTotal = absentDays * absenceDeduction;
  const totalSalary = baseSalary + bonus + overtimeBonus - undertimeDeductionTotal - absenceDeductionTotal;
  if (totalSalary < 0) {
    console.error('Total salary is negative. Check input values.', { totalSalary, salaryId });
    return NextResponse.json({ error: 'Total salary cannot be negative. Please review the input values.' }, { status: 400 });
  }
  // Mark original as corrected
  await prisma.salary.update({ where: { id: salaryId }, data: { status: "corrected" } });
  // Save calculation breakdown
  const breakdown = {
    baseSalary,
    salesTotal,
    bonusPercent,
    totalWorkedHours,
    overtimeRate,
    undertimeDeduction,
    absenceDeduction,
    absentDays,
  };
  // Create correction
  const newSalary = await prisma.salary.create({
    data: {
      employeeId: originalSalary.employeeId,
      amount: totalSalary,
      status: "paid",
      payDate: originalSalary.payDate,
      correctionOf: salaryId,
      deleted: false,
      metadata: breakdown, // Save all calculation fields in metadata
      startDate: originalSalary.startDate,
      endDate: originalSalary.endDate,
    },
  });

  // Audit log: log salary correction
  await prisma.salaryAuditLog.create({
    data: {
      salaryId: newSalary.id,
      action: 'correct',
      oldValue: originalSalary,
      newValue: newSalary,
      changedBy: auth.session?.user?.email ?? 'admin',
    }
  });

  // Get admin info for notification
  const admin = await prisma.user.findFirst({ where: { role: "admin" } });

  // Notify employee
  try {
    await notifyUserOrEmployee({
      employeeId: originalSalary.employeeId,
      type: "employee_salary_corrected",
      message: `Your salary for ${new Date(originalSalary.payDate).toLocaleDateString()} has been corrected. New amount: $${totalSalary.toLocaleString()}`,
      actionUrl: "/employee/salary",
      actionLabel: "View Salary",
      broadcastToEmployee: true,
    });
  } catch (notifyErr) {
    console.error("[Notification] Failed to notify employee of salary correction:", notifyErr);
  }

  // Notify admin
  if (admin) {
    try {
      await notifyUserOrEmployee({
        userId: admin.id,
        type: "admin_salary_corrected",
        message: `Salary corrected for ${originalSalary.employee?.user?.name || originalSalary.employee?.user?.email} for ${new Date(originalSalary.payDate).toLocaleDateString()}. New amount: $${totalSalary.toLocaleString()}`,
        actionUrl: `/admin/salaries`,
        actionLabel: "View Salaries",
        broadcastToAdmin: true,
      });
    } catch (notifyErr) {
      console.error("[Notification] Failed to notify admin of salary correction:", notifyErr);
    }
  }

  console.log(`Salary correction: originalId=${salaryId}, newId=${newSalary.id}, amount=${totalSalary}`);
  return NextResponse.json({
    originalSalary,
    correctedSalary: newSalary,
    totalSalary,
  });
} 