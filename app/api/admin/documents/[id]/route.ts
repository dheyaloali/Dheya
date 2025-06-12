import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { notifyUserOrEmployee } from "@/lib/notifications";

export async function PUT(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Require admin authentication
  const auth = await requireAuth(request, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    // Fix: Await the params object before using its properties
    const paramsData = await params;
    const id = parseInt(paramsData.id);
    
    // Parse the request body
    const body = await request.json();
    const { status, rejectionReason } = body;

    // Validate the document exists
    const documentExists = await prisma.document.findUnique({
      where: { id }
    });

    if (!documentExists) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Update the document status
    const updatedDocument = await prisma.document.update({
      where: { id },
      data: { status }
    });

    // Notify employee of document approval/rejection
    try {
      const employee = await prisma.employee.findUnique({
        where: { id: updatedDocument.employeeId },
        include: { user: true }
      });
      if (employee) {
        const sessionToken = request.cookies?.get?.('next-auth.session-token')?.value || request.cookies?.get?.('next-auth.session-token.0')?.value || request.cookies?.['next-auth.session-token'];
        const now = new Date().toLocaleString();
        if (status === "Approved") {
          await notifyUserOrEmployee({
            employeeId: employee.id,
            type: "employee_document_approved",
            message: `Admin approved your document '${updatedDocument.title}' on ${now}.`,
            actionUrl: "/employee/documents",
            actionLabel: "View Documents",
            sessionToken,
            broadcastToEmployee: true,
          });
          await notifyUserOrEmployee({
            userId: auth.session?.user?.id,
            type: "admin_document_approved",
            message: `You approved the document '${updatedDocument.title}' for employee ${employee.user?.name || employee.user?.email} on ${now}.`,
            actionUrl: `/admin/employees/${employee.id}/details`,
            actionLabel: "View Employee",
            sessionToken,
            broadcastToAdmin: true,
          });
        } else if (status === "Rejected") {
          await notifyUserOrEmployee({
            employeeId: employee.id,
            type: "employee_document_rejected",
            message: `Admin rejected your document '${updatedDocument.title}' on ${now}.${rejectionReason ? ' Reason: ' + rejectionReason : ''}`,
            actionUrl: "/employee/documents",
            actionLabel: "Upload Document",
            sessionToken,
            broadcastToEmployee: true,
          });
          await notifyUserOrEmployee({
            userId: auth.session?.user?.id,
            type: "admin_document_rejected",
            message: `You rejected the document '${updatedDocument.title}' for employee ${employee.user?.name || employee.user?.email} on ${now}.`,
            actionUrl: `/admin/employees/${employee.id}/details`,
            actionLabel: "View Employee",
            sessionToken,
            broadcastToAdmin: true,
          });
        }
      }
    } catch (notifyErr) {
      console.error("[Notification] Failed to notify employee of document approval/rejection:", notifyErr);
    }

    // Log the action before updating
    await prisma.documentAuditLog.create({
      data: {
        documentId: id,
        action: status === "Approved" ? "approve" : status === "Rejected" ? "reject" : "update",
        oldStatus: documentExists.status,
        newStatus: status,
        rejectionReason: status === "Rejected" ? (rejectionReason ?? documentExists.rejectionReason ?? null) : (documentExists.rejectionReason ?? null),
        adminId: auth.session?.user?.email || null,
      }
    });

    return NextResponse.json(updatedDocument);

  } catch (error) {
    console.error("Error updating document:", error);
    return NextResponse.json(
      { error: "Failed to update document" },
      { status: 500 }
    );
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  // Require admin authentication
  const auth = await requireAuth(request, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    // Fix: Await the params object before using its properties
    const paramsData = await params;
    const id = parseInt(paramsData.id);

    // Validate the document exists
    const documentExists = await prisma.document.findUnique({
      where: { id }
    });

    if (!documentExists) {
      return NextResponse.json(
        { error: "Document not found" },
        { status: 404 }
      );
    }

    // Log the delete action BEFORE deleting the document
    try {
      await prisma.documentAuditLog.create({
        data: {
          documentId: id,
          action: "delete",
          oldStatus: documentExists.status,
          newStatus: null,
          rejectionReason: 'rejectionReason' in documentExists ? (documentExists.rejectionReason ?? null) : null,
          adminId: auth.session?.user?.email || null,
        }
      });
    } catch (logError) {
      // Log the error but do not block the delete
      console.error("Failed to create audit log for document delete:", logError);
    }

    // Notify employee of document deletion
    try {
      const now = new Date().toLocaleString();
      if (documentExists.employeeId) {
        await notifyUserOrEmployee({
          employeeId: documentExists.employeeId,
          type: "employee_document_deleted",
          message: `Admin deleted your document '${documentExists.title}' on ${now}.`,
          actionUrl: "/employee/documents",
          actionLabel: "View Documents",
        });
        await notifyUserOrEmployee({
          userId: auth.session?.user?.id,
          type: "admin_document_deleted",
          message: `You deleted the document '${documentExists.title}' for employee ${documentExists.employeeId} on ${now}.`,
          actionUrl: `/admin/employees/${documentExists.employeeId}/details`,
          actionLabel: "View Employee",
        });
      }
    } catch (notifyErr) {
      console.error("[Notification] Failed to notify employee of document deletion:", notifyErr);
    }

    // Delete the document
    await prisma.document.delete({
      where: { id }
    });

    return NextResponse.json({ success: true });

  } catch (error) {
    console.error("Error deleting document:", error);
    return NextResponse.json(
      { error: "Failed to delete document" },
      { status: 500 }
    );
  }
}