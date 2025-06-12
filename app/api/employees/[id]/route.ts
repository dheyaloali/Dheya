import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { notifyUserOrEmployee } from "@/lib/notifications";

export async function PATCH(req: NextRequest, context: any) {
  const auth = await requireAuth(req, true); // Only admin can update
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const params = await context.params;
  const { id } = params;
  const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
  try {
    const data = await req.json();
    
    // Combine operations in a single transaction for better performance
    const updated = await prisma.$transaction(async (tx) => {
      // Update employee fields
      const employee = await tx.employee.update({
      where: { id: Number(id) },
      data: {
        city: data.city,
        position: data.position,
        joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
      },
      include: { user: true },
    });
      
      // Validate phone number if provided
      if (data.phoneNumber !== undefined) {
        if (typeof data.phoneNumber !== 'string' || !/^\+62\d{9,13}$/.test(data.phoneNumber.trim())) {
          throw new Error("Phone number must be in Indonesian format: +62xxxxxxxxxxx");
        }
      }
      // Update user fields if provided in same transaction
      if (data.name || data.email || data.status || data.phoneNumber !== undefined) {
        await tx.user.update({
        where: { id: employee.userId },
        data: {
          name: data.name || employee.user.name,
          email: data.email || employee.user.email,
          ...(data.status ? { status: data.status.toLowerCase() } : {}),
          ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber.trim() } : {}),
        },
      });
    }
      
      // Return the updated employee without requiring a separate query
      return {
        ...employee,
        user: {
          ...employee.user,
          name: data.name || employee.user.name,
          email: data.email || employee.user.email,
          ...(data.status ? { status: data.status.toLowerCase() } : {}),
          ...(data.phoneNumber !== undefined ? { phoneNumber: data.phoneNumber.trim() } : { phoneNumber: employee.user.phoneNumber }),
        }
      };
    });
    
    // Send response immediately without waiting for notifications
    const response = NextResponse.json({ employee: updated });
    
    // Safely extract admin user ID, checking for undefined values
    const adminUserId = auth?.user?.id || auth?.session?.user?.id;
    
    // Fire off notifications asynchronously - don't await this
    setTimeout(async () => {
    try {
      const now = new Date().toLocaleString();
      // Notify employee (only employeeId)
      await notifyUserOrEmployee({
        employeeId: updated?.id,
        type: "employee_profile_updated",
        message: `Admin updated your profile on ${now}.`,
        actionUrl: "/employee/profile",
        actionLabel: "View Profile",
        sessionToken,
        broadcastToEmployee: true,
      });
      
      // Only send admin notification if we have a valid admin user ID
      if (adminUserId) {
        // Notify the admin as well (only userId)
        await notifyUserOrEmployee({
          userId: adminUserId,
          type: "admin_profile_update",
          message: `You updated the profile for ${updated?.user?.name || updated?.user?.email} on ${now}.`,
          actionUrl: `/admin/employees/${updated?.id}/details`,
          actionLabel: "View Employee",
          sessionToken,
        });
      }
    } catch (notifyErr) {
      console.error("[Notification] Failed to notify employee or admin of profile update:", notifyErr);
    }
    }, 0);
    
    return response;
  } catch (error) {
    console.error("Employee update error:", error);
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const auth = await requireAuth(req, true); // Only admin can delete
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const params = await context.params;
  const id = params.id;
  const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
  try {
    // Find the employee to get the userId
    const employee = await prisma.employee.findUnique({ where: { id: Number(id) }, include: { user: true } });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    // Notify the employee before deletion
    try {
      const now = new Date().toLocaleString();
      await notifyUserOrEmployee({
        employeeId: employee.id,
        type: "employee_account_deleted",
        message: `Admin deleted your account on ${now}.`,
        actionUrl: "/login",
        actionLabel: "Go to Login",
        sessionToken,
        broadcastToEmployee: true,
      });
      await notifyUserOrEmployee({
        userId: auth.user.id,
        type: "admin_account_deleted",
        message: `You deleted the account for ${employee.user?.name || employee.user?.email} on ${now}.`,
        actionUrl: "/admin/employees",
        actionLabel: "View Employees",
        sessionToken,
      });
    } catch (notifyErr) {
      console.error("[Notification] Failed to notify employee of account deletion:", notifyErr);
    }
    // Delete related records first
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });
    await prisma.sale.deleteMany({ where: { employeeId: employee.id } });
    await prisma.document.deleteMany({ where: { employeeId: employee.id } });
    // Delete the employee first, then the user
    await prisma.employee.delete({ where: { id: Number(id) } });
    await prisma.user.delete({ where: { id: employee.userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/employees/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete employee and user" }, { status: 500 });
  }
} 