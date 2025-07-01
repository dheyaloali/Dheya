import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { notifyUserOrEmployee } from "@/lib/notifications";

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { ids, action, reason } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }
  if (!["approve", "reject"].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const results = [];
  for (const id of ids) {
    try {
      const document = await prisma.document.findUnique({ where: { id } });
      if (!document) {
        results.push({ id, status: "error", error: "Document not found" });
        continue;
      }
      const updated = await prisma.document.update({
        where: { id },
        data: { status: action === "approve" ? "Approved" : "Rejected" }
      });
      // Notify logic (same as single)
      try {
        const employee = await prisma.employee.findUnique({
          where: { id: updated.employeeId },
          include: { user: true }
        });
        if (employee) {
          const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
          const now = new Date().toLocaleString();
          if (action === "approve") {
            await notifyUserOrEmployee({
              employeeId: employee.id,
              type: "employee_document_approved",
              message: `Admin approved your document '${updated.title}' on ${now}.`,
              actionUrl: "/employee/documents",
              actionLabel: "View Documents",
              sessionToken,
              broadcastToEmployee: true,
            });
            await notifyUserOrEmployee({
              userId: auth.session?.user?.id,
              type: "admin_document_approved",
              message: `You approved the document '${updated.title}' for employee ${employee.user?.name || employee.user?.email} on ${now}.`,
              actionUrl: `/admin/employees/${employee.id}/details`,
              actionLabel: "View Employee",
              sessionToken,
              broadcastToAdmin: true,
            });
          } else if (action === "reject") {
            await notifyUserOrEmployee({
              employeeId: employee.id,
              type: "employee_document_rejected",
              message: `Admin rejected your document '${updated.title}' on ${now}.${reason ? ' Reason: ' + reason : ''}`,
              actionUrl: "/employee/documents",
              actionLabel: "Upload Document",
              sessionToken,
              broadcastToEmployee: true,
            });
            await notifyUserOrEmployee({
              userId: auth.session?.user?.id,
              type: "admin_document_rejected",
              message: `You rejected the document '${updated.title}' for employee ${employee.user?.name || employee.user?.email} on ${now}.`,
              actionUrl: `/admin/employees/${employee.id}/details`,
              actionLabel: "View Employee",
              sessionToken,
              broadcastToAdmin: true,
            });
          }
        }
      } catch (notifyErr) {}
      // Audit log
      await prisma.documentAuditLog.create({
        data: {
          documentId: id,
          action: action,
          oldStatus: document.status,
          newStatus: action === "approve" ? "Approved" : "Rejected",
          rejectionReason: action === "reject" ? (reason ?? document.rejectionReason ?? null) : (document.rejectionReason ?? null),
          adminId: auth.session?.user?.email || null,
        }
      });
      results.push({ id, status: "success" });
    } catch (err) {
      results.push({ id, status: "error", error: err?.message || "Unknown error" });
    }
  }
  return NextResponse.json({ results });
} 