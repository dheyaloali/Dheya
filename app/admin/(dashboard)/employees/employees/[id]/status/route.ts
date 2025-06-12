import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";

const prisma = new PrismaClient();

export async function PATCH(req: NextRequest, context: any) {
  const auth = await requireAuth(req, true); // Only admin can update status
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const params = await context.params;
  const { id } = params;
  try {
    const { status } = await req.json();
    if (!status || (status.toLowerCase() !== "active" && status.toLowerCase() !== "inactive")) {
      return NextResponse.json({ error: "Invalid status" }, { status: 400 });
    }
    // Find the employee to get the userId
    const employee = await prisma.employee.findUnique({ where: { id: Number(id) } });
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    // Update the status on the User model
    const user = await prisma.user.update({
      where: { id: employee.userId },
      data: { status: status.toLowerCase() },
    });
    return NextResponse.json({ success: true, user });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update status" }, { status: 500 });
  }
} 