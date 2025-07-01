import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
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
  if (action === "reject" && (!reason || typeof reason !== "string" || !reason.trim())) {
    return NextResponse.json({ error: "Rejection reason required" }, { status: 400 });
  }

  // Fetch all requests to ensure they exist and are pending
  const requests = await prisma.documentDeleteRequest.findMany({
    where: { id: { in: ids }, status: "pending" },
    include: { document: true },
  });

  const results: { id: number, status: string, error?: string }[] = [];

  for (const req of requests) {
    try {
      if (action === "approve") {
        if (req.document) {
          // Optionally: delete file from disk here
          await prisma.document.delete({ where: { id: req.documentId } });
        }
        await prisma.documentDeleteRequest.update({
          where: { id: req.id },
          data: { status: "approved", reviewedAt: new Date() },
        });
        results.push({ id: req.id, status: "approved" });
      } else if (action === "reject") {
        await prisma.documentDeleteRequest.update({
          where: { id: req.id },
          data: { status: "rejected", reviewedAt: new Date(), rejectionReason: reason },
        });
        results.push({ id: req.id, status: "rejected" });
      }
    } catch (err: any) {
      results.push({ id: req.id, status: "error", error: err.message });
    }
  }

  // Send summary notification to admin
  try {
    const now = new Date();
    const successCount = results.filter(r => r.status !== "error").length;
    const failCount = results.filter(r => r.status === "error").length;
    const details = results.map(r => `ID ${r.id}: ${r.status}${r.error ? ` (${r.error})` : ""}`).join(", ");
    const message = `Batch processed at ${now.toLocaleString()}: ${successCount} succeeded, ${failCount} failed. Details: ${details}`;
    await notifyUserOrEmployee({
      type: "admin_batch_delete_requests_result",
      message,
      actionUrl: "/admin/documents",
      actionLabel: "View Results",
      broadcastToAdmin: true,
      createdAt: now.toISOString(),
      userId: auth.session?.user?.id,
    });
  } catch (notifyErr) {
    // Notification errors are ignored for robustness
  }

  return NextResponse.json({ results });
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });

  const { ids } = await req.json();
  if (!Array.isArray(ids) || ids.length === 0) {
    return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
  }

  const results: { id: number, status: string, error?: string }[] = [];
  for (const id of ids) {
    try {
      await prisma.documentDeleteRequest.delete({ where: { id } });
      results.push({ id, status: "deleted" });
    } catch (err: any) {
      results.push({ id, status: "error", error: err.message });
    }
  }

  return NextResponse.json({ results });
} 