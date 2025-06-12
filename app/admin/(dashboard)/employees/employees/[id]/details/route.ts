import { NextRequest, NextResponse } from "next/server";
import { PrismaClient, Prisma } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";

const prisma = new PrismaClient();

type ProductAssignment = {
  productId: number;
  quantity: number;
};

export async function GET(req: NextRequest, context: any) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const params = await context.params;
  const id = params.id;
  try {
    const employee = await prisma.employee.findUnique({
      where: { id: Number(id) },
      include: {
        user: true,
        sales: true,
        attendance: true,
        documents: true,
        employeeProducts: {
          include: {
            product: true
          }
        }
      },
    }) as any;
    if (!employee) {
      return NextResponse.json({ error: "Employee not found" }, { status: 404 });
    }
    // Flatten assigned products for easier frontend use
    const assignedProducts = employee.employeeProducts.map((ep: any) => ({
      ...ep.product,
      quantity: ep.quantity || 1
    }));
    return NextResponse.json({ employee: { ...employee, assignedProducts } });
  } catch (error) {
    console.error("GET /api/employees/[id]/details error:", error);
    return NextResponse.json({ error: "Failed to fetch employee details" }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest, context: any) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const params = await context.params;
  const id = Number(params.id);
  try {
    const { assignments } = await req.json() as { assignments: ProductAssignment[] };
    if (!Array.isArray(assignments)) {
      return NextResponse.json({ error: "Invalid assignments" }, { status: 400 });
    }
    // Validate each assignment
    for (const a of assignments) {
      if (!a.productId || typeof a.quantity !== 'number' || a.quantity <= 0) {
        return NextResponse.json({ error: "Each assignment must have a valid productId and a positive quantity" }, { status: 400 });
      }
    }
    // Use a transaction to ensure atomicity
    const result = await prisma.$transaction(async (tx: any) => {
      // Fetch current assignments
      const currentAssignments = await tx.employeeProduct.findMany({ where: { employeeId: id } });
      // Determine assignments to delete (those not in the new list)
      const currentProductIds = currentAssignments.map((a: { productId: number }) => a.productId);
      const newProductIds = assignments.map((a: { productId: number }) => a.productId);
      const toDelete = currentAssignments.filter((a: { productId: number }) => !newProductIds.includes(a.productId));
      // Delete assignments not in the new list
      if (toDelete.length > 0) {
        await tx.employeeProduct.deleteMany({ where: { id: { in: toDelete.map((a: { id: number }) => a.id) } } });
      }
      // Update or create new assignments
      for (const a of assignments) {
        const existing = currentAssignments.find((ca: { productId: number }) => ca.productId === a.productId);
        if (existing) {
          // Update the quantity for existing assignment
          await tx.employeeProduct.update({
            where: { id: existing.id },
            data: { quantity: a.quantity }
          });
        } else {
          await tx.employeeProduct.create({
            data: {
              employeeId: id,
              productId: a.productId,
              assignedAt: new Date(),
              quantity: a.quantity
            }
          });
        }
      }
      // Fetch updated assignments for response
      const updatedAssignments = await tx.employeeProduct.findMany({ 
        where: { employeeId: id }, 
        include: { product: true } 
      });
      // Add quantities to the response
      return updatedAssignments.map((assignment: any) => ({
        ...assignment,
        quantity: assignments.find(a => a.productId === assignment.productId)?.quantity || 1
      }));
    });
    return NextResponse.json({ success: true, assignments: result });
  } catch (error) {
    console.error("PATCH /api/employees/[id]/details error:", error);
    return NextResponse.json({ error: "Failed to update product assignments" }, { status: 500 });
  }
} 