import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { checkRateLimit } from '@/lib/rateLimiter';

export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  // Rate limiting: 5 deletes per hour per employee
  if (!checkRateLimit(`delete-request:${userId}`, { windowMs: 60 * 60 * 1000, max: 5 })) {
    return NextResponse.json({ error: "Too many delete actions. Please try again later." }, { status: 429 });
  }
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const requestId = parseInt(params.id, 10);
  const request = await prisma.documentDeleteRequest.findUnique({ where: { id: requestId }, select: { id: true, employeeId: true } });
  if (!request || request.employeeId !== employee.id) {
    return NextResponse.json({ error: "Delete request not found or not yours" }, { status: 404 });
  }

  await prisma.documentDeleteRequest.delete({ where: { id: requestId } });
  return NextResponse.json({ success: true });
} 