import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { notifyUserOrEmployee } from "@/lib/notifications";

export const runtime = 'nodejs';

export async function DELETE(
  req: NextRequest,
  { params }: { params: { id: string } }
) {
  try {
    const auth = await requireAuth(req, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    // Get the ID from params
    const id = parseInt(params.id, 10);
    if (isNaN(id)) {
      return NextResponse.json({ error: "Invalid salary ID." }, { status: 400 });
    }

    const salary = await prisma.salary.findUnique({ 
      where: { id },
      include: { employee: { include: { user: true } } }
    });
    if (!salary) {
      return NextResponse.json({ error: "Salary not found." }, { status: 404 });
    }

    // Audit log: log salary deletion
await prisma.salaryAuditLog.create({
  data: {
    salaryId: salary.id,
    action: 'delete',
    oldValue: salary,
    newValue: undefined,
    changedBy: auth.session?.user?.email ?? 'admin',
  }
});

    // Soft delete the salary
    await prisma.salary.update({
      where: { id },
      data: { 
        deleted: true,
        status: "deleted",
        updatedAt: new Date()
      }
    });

    // Get admin info for notification
    const admin = await prisma.user.findFirst({ where: { role: "admin" } });

    // Notify employee
    try {
      await notifyUserOrEmployee({
        employeeId: salary.employeeId,
        type: "employee_salary_deleted",
        message: `Your salary record for ${new Date(salary.payDate).toLocaleDateString()} has been deleted.`,
        actionUrl: "/employee/salary",
        actionLabel: "View Salary",
        broadcastToEmployee: true,
      });
    } catch (notifyErr) {
      console.error("[Notification] Failed to notify employee of salary deletion:", notifyErr);
    }

    // Notify admin
    if (admin) {
      try {
        await notifyUserOrEmployee({
          userId: admin.id,
          type: "admin_salary_deleted",
          message: `Salary record deleted for ${salary.employee?.user?.name || salary.employee?.user?.email} for ${new Date(salary.payDate).toLocaleDateString()}`,
          actionUrl: `/admin/salaries`,
          actionLabel: "View Salaries",
          broadcastToAdmin: true,
        });
      } catch (notifyErr) {
        console.error("[Notification] Failed to notify admin of salary deletion:", notifyErr);
      }
    }

    console.log(`Salary soft-deleted: id=${id}`);
    return NextResponse.json({ 
      success: true, 
      message: "Salary deleted." 
    });
  } catch (error) {
    console.error('Error deleting salary:', error);
    return NextResponse.json({ 
      error: "An error occurred while deleting the salary" 
    }, { status: 500 });
  }
}