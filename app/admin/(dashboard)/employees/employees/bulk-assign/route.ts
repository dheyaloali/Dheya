import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";

const prisma = new PrismaClient();

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, true); // Only admin
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { employeeIds, assignments } = await req.json();
    if (!Array.isArray(employeeIds) || !Array.isArray(assignments)) {
      return NextResponse.json({ error: "Invalid input" }, { status: 400 });
    }
    for (const empId of employeeIds) {
      for (const { productId, quantity } of assignments) {
        await prisma.employeeProduct.upsert({
          where: { employeeId_productId: { employeeId: empId, productId } },
          update: { quantity },
          create: { employeeId: empId, productId, quantity },
        });
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Bulk assignment failed", details: String(error) }, { status: 500 });
  }
} 