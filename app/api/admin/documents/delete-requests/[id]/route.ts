import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";
import { notifyUserOrEmployee } from "@/lib/notifications";

// PATCH: Admin approves or rejects a document delete request
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !(session.user as any).isAdmin) {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }

  const id = Number(params.id);
  const { action } = await req.json(); // action: 'approve' or 'reject'
  if (!['approve', 'reject'].includes(action)) {
    return NextResponse.json({ error: "Invalid action" }, { status: 400 });
  }

  const request = await prisma.documentDeleteRequest.findUnique({
    where: { id },
    include: { document: true },
  });
  if (!request) return NextResponse.json({ error: "Request not found" }, { status: 404 });
  if (request.status !== "pending") {
    return NextResponse.json({ error: "Request already processed" }, { status: 409 });
  }

  let updated;
  if (action === "approve") {
    // Delete the document and its file
    const filePath = path.join(process.cwd(), "public", request.document.fileUrl);
    try { await fs.unlink(filePath); } catch {}
    await prisma.document.delete({ where: { id: request.documentId } });
    updated = await prisma.documentDeleteRequest.update({
      where: { id },
      data: { status: "approved", reviewedAt: new Date() },
    });
    // Notify employee of approval
    if (request.document.employeeId) {
      await notifyUserOrEmployee({
        employeeId: request.document.employeeId,
        type: "document_delete_approved",
        message: "Your request to delete a document was approved.",
        actionUrl: "/employee/documents",
        actionLabel: "View Documents",
      });
    }
  } else {
    updated = await prisma.documentDeleteRequest.update({
      where: { id },
      data: { status: "rejected", reviewedAt: new Date() },
    });
    // Notify employee of rejection
    if (request.document.employeeId) {
      await notifyUserOrEmployee({
        employeeId: request.document.employeeId,
        type: "document_delete_rejected",
        message: "Your request to delete a document was rejected.",
        actionUrl: "/employee/documents",
        actionLabel: "View Documents",
      });
    }
  }
  return NextResponse.json(updated);
} 