import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

// PUT: Edit a report
export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const employee = await prisma.employee.findFirst({ where: { userId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const id = params.id;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report || report.employeeId !== employee.id) {
    return NextResponse.json({ error: "Not authorized or report not found" }, { status: 403 });
  }

  const { type, notes } = await req.json();
  if (!type) return NextResponse.json({ error: "Type is required" }, { status: 400 });

  const updated = await prisma.report.update({
    where: { id },
    data: { type, notes },
  });
  return NextResponse.json(updated);
}

// DELETE: Delete a report
export async function DELETE(req: NextRequest, { params }: { params: { id: string } }) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const employee = await prisma.employee.findFirst({ where: { userId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const id = params.id;
  const report = await prisma.report.findUnique({ where: { id } });
  if (!report || report.employeeId !== employee.id) {
    return NextResponse.json({ error: "Not authorized or report not found" }, { status: 403 });
  }

  await prisma.report.delete({ where: { id } });
  return NextResponse.json({ success: true });
}