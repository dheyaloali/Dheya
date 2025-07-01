import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { promises as fs } from "fs";
import path from "path";

// GET: Download a document file
export async function GET(req: NextRequest, { params }: { params: { id: string } }) {
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
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.employeeId !== employee.id) {
    return NextResponse.json({ error: "Not authorized or document not found" }, { status: 403 });
  }
  // Serve the file
  const filePath = path.join(process.cwd(), "public", document.fileUrl);
  try {
    const fileBuffer = await fs.readFile(filePath);
    return new NextResponse(fileBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/octet-stream",
        "Content-Disposition": `attachment; filename=\"${path.basename(filePath)}\"`,
      },
    });
  } catch {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }
}

// PUT: Edit document metadata
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
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.employeeId !== employee.id) {
    return NextResponse.json({ error: "Not authorized or document not found" }, { status: 403 });
  }
  const { title, type, description, status } = await req.json();
  const updated = await prisma.document.update({
    where: { id },
    data: { title, type, description, status },
  });
  return NextResponse.json(updated);
}

// DELETE: Delete a document and its file
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
  const document = await prisma.document.findUnique({ where: { id } });
  if (!document || document.employeeId !== employee.id) {
    return NextResponse.json({ error: "Not authorized or document not found" }, { status: 403 });
  }
  // Delete file from disk
  const filePath = path.join(process.cwd(), "public", document.fileUrl);
  try {
    await fs.unlink(filePath);
  } catch {}
  await prisma.document.delete({ where: { id } });
  return NextResponse.json({ success: true });
}