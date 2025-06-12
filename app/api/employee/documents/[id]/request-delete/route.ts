import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { notifyUserOrEmployee } from "@/lib/notifications";
import { checkRateLimit } from '@/lib/rateLimiter';

// POST: Employee requests document deletion
export async function POST(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  // Rate limiting: 5 requests per hour per employee
  if (!checkRateLimit(`request-delete:${userId}`, { windowMs: 60 * 60 * 1000, max: 5 })) {
    return NextResponse.json({ error: "Too many delete requests. Please try again later." }, { status: 429 });
  }
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true, user: { select: { name: true, email: true } } } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const documentId = Number(params.id);
  const document = await prisma.document.findUnique({ where: { id: documentId }, select: { id: true, employeeId: true, title: true } });
  if (!document || document.employeeId !== employee.id) {
    return NextResponse.json({ error: "Not authorized or document not found" }, { status: 403 });
  }

  // Check for existing pending request
  const existing = await prisma.documentDeleteRequest.findFirst({
    where: { documentId, employeeId: employee.id, status: "pending" },
    select: { id: true },
  });
  if (existing) {
    return NextResponse.json({ error: "A pending delete request already exists for this document." }, { status: 409 });
  }

  const { reason } = await req.json();
  if (!reason || reason.length < 5) {
    return NextResponse.json({ error: "Reason is required and must be at least 5 characters." }, { status: 400 });
  }

  const request = await prisma.documentDeleteRequest.create({
    data: {
      documentId,
      employeeId: employee.id,
      reason,
      status: "pending",
      createdAt: new Date(),
    },
    select: { id: true, documentId: true, employeeId: true, status: true, createdAt: true },
  });
  // Notify admin after request
  const admin = await prisma.user.findFirst({ where: { role: "admin" }, select: { id: true } });
  const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
  if (admin) {
    await notifyUserOrEmployee({
      userId: admin.id,
      type: "document_delete_requested",
      message: `${employee.user.name || employee.user.email} requested to delete document \"${document.title}\" (ID: ${documentId}) on ${new Date().toLocaleString()}.`,
      actionUrl: "/admin/employees",
      actionLabel: "Review Employees",
      sessionToken,
    });
  }
  return NextResponse.json(request);
} 