import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUserOrEmployee } from "@/lib/notifications";

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
    }
    const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
    for (const id of ids) {
      const employee = await prisma.employee.findUnique({ where: { id: Number(id) }, include: { user: true } });
      if (!employee) continue;
      // Notify the employee before deletion
      try {
        await notifyUserOrEmployee({
          employeeId: employee.id,
          type: "account_deleted",
          message: "Your account was deleted by the admin (bulk action).",
          actionUrl: "/login",
          actionLabel: "Go to Login",
          sessionToken,
          broadcastToEmployee: true,
        });
      } catch (notifyErr) {
        console.error("[Notification] Failed to notify employee of bulk account deletion:", notifyErr);
      }
      await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });
      await prisma.sale.deleteMany({ where: { employeeId: employee.id } });
      await prisma.document.deleteMany({ where: { employeeId: employee.id } });
      await prisma.salary.deleteMany({ where: { employeeId: employee.id } });
      await prisma.timeLog.deleteMany({ where: { employeeId: employee.id } });
      await prisma.salesRecord.deleteMany({ where: { employeeId: employee.id } });
      await prisma.absenceRecord.deleteMany({ where: { employeeId: employee.id } });
      await prisma.employeeProduct.deleteMany({ where: { employeeId: employee.id } });
      await prisma.employeeLocation.deleteMany({ where: { employeeId: employee.id } });
      await prisma.report.deleteMany({ where: { employeeId: employee.id } });
      await prisma.employee.delete({ where: { id: Number(id) } });
      await prisma.user.delete({ where: { id: employee.userId } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("BULK DELETE /api/employees/bulk-delete error:", error);
    return NextResponse.json({ error: "Failed to bulk delete employees" }, { status: 500 });
  }
} 