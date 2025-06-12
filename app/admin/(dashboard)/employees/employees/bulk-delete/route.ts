import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  try {
    const { ids } = await req.json();
    if (!Array.isArray(ids) || ids.length === 0) {
      return NextResponse.json({ error: "No IDs provided" }, { status: 400 });
    }
    for (const id of ids) {
      const employee = await prisma.employee.findUnique({ where: { id: Number(id) } });
      if (!employee) continue;
      await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });
      await prisma.sale.deleteMany({ where: { employeeId: employee.id } });
      await prisma.document.deleteMany({ where: { employeeId: employee.id } });
      await prisma.employee.delete({ where: { id: Number(id) } });
      await prisma.user.delete({ where: { id: employee.userId } });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("BULK DELETE /api/employees/bulk-delete error:", error);
    return NextResponse.json({ error: "Failed to bulk delete employees" }, { status: 500 });
  }
} 