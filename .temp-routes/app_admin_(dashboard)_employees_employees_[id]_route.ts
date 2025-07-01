import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";

const prisma = new PrismaClient();

export async function PATCH(req: NextRequest, context: any) {
  const auth = await requireAuth(req, true); // Only admin can update
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const params = await context.params;
  const { id } = params;
  try {
    const data = await req.json();
    // Update employee fields (excluding status)
    const employee = await prisma.employee.update({
      where: { id: Number(id) },
      data: {
        city: data.city,
        position: data.position,
        joinDate: data.joinDate ? new Date(data.joinDate) : undefined,
      },
      include: { user: true },
    });
    // Update user fields if provided
    if (data.name || data.email || data.status) {
      await prisma.user.update({
        where: { id: employee.userId },
        data: {
          name: data.name || employee.user.name,
          email: data.email || employee.user.email,
          ...(data.status ? { status: data.status.toLowerCase() } : {}),
        },
      });
    }
    // Refetch updated employee with user
    const updated = await prisma.employee.findUnique({
      where: { id: Number(id) },
      include: { user: true },
    });
    return NextResponse.json({ employee: updated });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update employee" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const auth = await requireAuth(req, true); // Only admin can delete
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const params = await context.params;
  const id = params.id;
  try {
    // Find the employee to get the userId
    const employee = await prisma.employee.findUnique({ where: { id: Number(id) } });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    // Delete related records first
    await prisma.attendance.deleteMany({ where: { employeeId: employee.id } });
    await prisma.sale.deleteMany({ where: { employeeId: employee.id } });
    await prisma.document.deleteMany({ where: { employeeId: employee.id } });
    // Delete the employee first, then the user
    await prisma.employee.delete({ where: { id: Number(id) } });
    await prisma.user.delete({ where: { id: employee.userId } });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("DELETE /api/employees/[id] error:", error);
    return NextResponse.json({ error: "Failed to delete employee and user" }, { status: 500 });
  }
} 