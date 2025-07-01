import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { notifyUserOrEmployee } from "@/lib/notifications";

export async function PATCH(req: NextRequest, context: any) {
  const auth = await requireAuth(req, true); // Only admin can update status
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const params = await context.params;
  const { id } = params;
  const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
  try {
    const { status } = await req.json();
    if (!status || (status.toLowerCase() !== "active" && status.toLowerCase() !== "inactive")) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    // Find the employee to get the userId
    const employee = await prisma.employee.findUnique({ where: { id: Number(id) }, include: { user: true } });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    // Update the status on the User model
    const user = await prisma.user.update({
      where: { id: employee.userId },
      data: { status: status.toLowerCase() },
    });
    // Notify the employee of the status change
    try {
      await notifyUserOrEmployee({
        employeeId: employee.id,
        type: "status_change",
        message: `Your account status was changed to ${status.charAt(0).toUpperCase() + status.slice(1).toLowerCase()} by the admin.`,
        actionUrl: "/employee/profile",
        actionLabel: "View Profile",
        sessionToken,
        broadcastToEmployee: true,
      });
      // Notify the admin as well
      await notifyUserOrEmployee({
        userId: auth.user.id, // The admin's User.id
        type: "admin_status_change",
        message: `You changed the status of employee ${employee.user.name || employee.user.email} to ${status} on ${new Date().toLocaleString()}`,
        actionUrl: `/admin/employees/${employee.id}/details`,
        actionLabel: "View Employee",
        sessionToken,
      });
    } catch (notifyErr) {
      console.error("[Notification] Failed to notify employee or admin of status change:", notifyErr);
    }
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
}