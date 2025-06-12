import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

// GET: List all document delete requests for the logged-in employee
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const employee = await prisma.employee.findFirst({ where: { userId }, select: { id: true } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const requests = await prisma.documentDeleteRequest.findMany({
    where: { employeeId: employee.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      documentId: true,
      reason: true,
      status: true,
      createdAt: true,
      document: { select: { title: true, type: true } },
    },
  });
  return NextResponse.json({ requests });
} 