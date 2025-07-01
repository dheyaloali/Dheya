import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { notifyUserOrEmployee } from "@/lib/notifications";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";

export async function POST(req: NextRequest) {
  try {
    const auth = await requireAuth(req, true); // Only admin can bulk delete
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
    }

    const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
    const results = [];

    for (const id of ids) {
      try {
        // First fetch the employee with all necessary data
        const employee = await prisma.employee.findUnique({ 
          where: { id: Number(id) }, 
          include: { 
            user: {
              select: {
                id: true,
                name: true,
                email: true
              }
            } 
          } 
        });

        if (!employee) {
          results.push({ id, status: "error", error: "Employee not found" });
          continue;
        }

        // Create notifications while employee data still exists
        try {
          // Notify the employee
        await notifyUserOrEmployee({
          employeeId: employee.id,
          type: "account_deleted",
          message: "Your account was deleted by the admin (bulk action).",
          actionUrl: "/login",
          actionLabel: "Go to Login",
          sessionToken,
          broadcastToEmployee: true,
        });

          // Notify the admin with date/time
          const now = new Date().toLocaleString();
          await notifyUserOrEmployee({
            userId: auth.session?.user?.id, // Get admin ID from session
            type: "admin_employee_deleted",
            message: `You deleted employee '${employee.user?.name || employee.user?.email}' (ID: ${employee.id}) via bulk action on ${now}.`,
            actionUrl: `/admin/employees`,
            actionLabel: "View Employees",
            sessionToken,
            broadcastToAdmin: true,
          });
      } catch (notifyErr) {
          console.error("[Notification] Failed to create notification:", notifyErr);
          // Continue with deletion even if notification fails
      }

      // Delete all related records in a single transaction
      await prisma.$transaction(async (tx: PrismaClient) => {
        await tx.attendance.deleteMany({ where: { employeeId: employee.id } });
        await tx.sale.deleteMany({ where: { employeeId: employee.id } });
        await tx.document.deleteMany({ where: { employeeId: employee.id } });
        await tx.salary.deleteMany({ where: { employeeId: employee.id } });
        await tx.timeLog.deleteMany({ where: { employeeId: employee.id } });
        await tx.salesRecord.deleteMany({ where: { employeeId: employee.id } });
        await tx.absenceRecord.deleteMany({ where: { employeeId: employee.id } });
        await tx.employeeProduct.deleteMany({ where: { employeeId: employee.id } });
        await tx.employeeLocation.deleteMany({ where: { employeeId: employee.id } });
        await tx.report.deleteMany({ where: { employeeId: employee.id } });
        await tx.employee.delete({ where: { id: Number(id) } });
        await tx.user.delete({ where: { id: employee.userId } });
      });

        results.push({ id, status: "success" });
      } catch (err) {
        console.error(`[Bulk Delete] Error processing employee ${id}:`, err);
        results.push({ id, status: "error", error: err?.message || "Unknown error" });
      }
    }

    return NextResponse.json({ results });
  } catch (error) {
    console.error("[Bulk Delete] Fatal error:", error);
    return NextResponse.json({ error: "Failed to bulk delete employees" }, { status: 500 });
  }
} 