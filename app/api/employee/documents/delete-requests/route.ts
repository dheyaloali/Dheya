import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

// GET: List all document delete requests for the logged-in employee or user
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  
  const userId = session.user.id;
  const isApproved = !!session.user.isApproved;
  
  let where: any = {};
  if (!isApproved) {
    // Unapproved: fetch by userId (through documents)
    where = {
      document: {
        userId: userId
      }
    };
  } else {
    // Approved: fetch by employeeId
    const employee = await prisma.employee.findFirst({ where: { userId } });
    if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    where.employeeId = employee.id;
  }

  const requests = await prisma.documentDeleteRequest.findMany({
    where,
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