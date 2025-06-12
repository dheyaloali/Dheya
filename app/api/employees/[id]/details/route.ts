import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notifyUserOrEmployee } from "@/lib/notifications";

const prismaClient = new PrismaClient();

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
  // Guard clause for missing or invalid id
  if (!id || isNaN(Number(id))) {
    return NextResponse.json({ error: "Invalid or missing employee id" }, { status: 400 });
  }
  try {
    const employee = await prismaClient.employee.findUnique({
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
      quantity: ep.quantity || 1,
      assignedAt: ep.assignedAt
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
  // Guard clause for missing or invalid id
  if (!id || isNaN(id)) {
    return NextResponse.json({ error: "Invalid or missing employee id" }, { status: 400 });
  }
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
    const result = await prismaClient.$transaction(async (tx: any) => {
      // Fetch current assignments
      const currentAssignments = await tx.employeeProduct.findMany({ where: { employeeId: id } });
      // Determine assignments to delete (those not in the new list)
      const currentProductIds = currentAssignments.map((a: { productId: number }) => a.productId);
      const newProductIds = assignments.map((a: { productId: number }) => a.productId);
      const toDelete = currentAssignments.filter((a: { productId: number }) => !newProductIds.includes(a.productId));
      
      // Delete assignments not in the new list
      if (toDelete.length > 0) {
        await tx.employeeProduct.deleteMany({ where: { id: { in: toDelete.map((a: { id: number }) => a.id) } } });
        // Notify employee of deleted assignments
        for (const del of toDelete) {
          const product = await tx.product.findUnique({ where: { id: del.productId } });
          try {
            await notifyUserOrEmployee({
              employeeId: id,
              type: "product_assignment_deleted",
              message: `Your assignment for product '${product?.name || del.productId}' was removed by the admin.`,
              actionUrl: "/employee/product",
              actionLabel: "View Products",
              broadcastToEmployee: true,
            });
          } catch (notifyErr) {
            console.error("[Notification] Failed to notify employee of assignment deletion:", notifyErr);
          }
        }
      }

      // Update or create new assignments
      for (const a of assignments) {
        const existing = currentAssignments.find((ca: { productId: number }) => ca.productId === a.productId);
        const product = await tx.product.findUnique({ where: { id: a.productId } });
        if (existing) {
          // Update the quantity for existing assignment
          await tx.employeeProduct.update({
            where: { id: existing.id },
            data: { quantity: a.quantity }
          });
          // Notify employee of update
          try {
            await notifyUserOrEmployee({
              employeeId: id,
              type: "product_assignment_updated",
              message: `Your assignment for product '${product?.name || a.productId}' was updated to quantity ${a.quantity} by the admin.`,
              actionUrl: "/employee/product",
              actionLabel: "View Products",
              broadcastToEmployee: true,
            });
          } catch (notifyErr) {
            console.error("[Notification] Failed to notify employee of assignment update:", notifyErr);
          }
        } else {
          await tx.employeeProduct.create({
            data: {
              employeeId: id,
              productId: a.productId,
              quantity: a.quantity,
              assignedAt: new Date(),
            },
          });
          // Notify employee of new assignment
          try {
            await notifyUserOrEmployee({
              employeeId: id,
              type: "product_assignment_created",
              message: `You have been assigned product '${product?.name || a.productId}' (quantity ${a.quantity}) by the admin.`,
              actionUrl: "/employee/product",
              actionLabel: "View Products",
              broadcastToEmployee: true,
            });
          } catch (notifyErr) {
            console.error("[Notification] Failed to notify employee of new assignment:", notifyErr);
          }
        }
      }
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("PATCH /api/employees/[id]/details error:", error);
    return NextResponse.json({ error: "Failed to update product assignments" }, { status: 500 });
  }
} 