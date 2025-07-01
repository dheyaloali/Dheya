import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function PATCH(req: NextRequest, context: any) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const { id } = context.params;
    const data = await req.json();

    // Update the product
    const updated = await prisma.product.update({
      where: { id: Number(id) },
      data,
      include: {
        assignedTo: {
          include: {
            user: true
          }
        }
      }
    });

    // Emit WebSocket event for product update
    const wsServerUrl = process.env.WS_SERVER_URL || process.env.NEXT_PUBLIC_WS_URL;
    if (wsServerUrl) {
      try {
        await fetch(`${wsServerUrl}/broadcast-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "product-update",
            data: {
              productId: updated.id,
              productName: updated.name,
              employeeId: updated.assignedTo?.id,
              employeeName: updated.assignedTo?.user?.name,
              stockLevel: updated.stockLevel,
              createdAt: new Date().toISOString(),
              broadcastTo: {
                admin: true,
                employee: true
              }
            }
          })
        });
      } catch (err) {
        console.error("[WebSocket] Failed to emit product-update event:", err);
      }
    }

    return NextResponse.json({ success: true, product: updated });
  } catch (error) {
    console.error("Error updating product:", error);
    return NextResponse.json({ error: "Failed to update product" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest, context: any) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const { id } = context.params;

    // Get product details before deletion
    const product = await prisma.product.findUnique({
      where: { id: Number(id) },
      include: {
        assignedTo: {
          include: {
            user: true
          }
        }
      }
    });

    if (!product) {
      return NextResponse.json({ error: "Product not found" }, { status: 404 });
    }

    // Delete the product
    await prisma.product.delete({
      where: { id: Number(id) }
    });

    // Emit WebSocket event for product deletion
    const wsServerUrl = process.env.WS_SERVER_URL || process.env.NEXT_PUBLIC_WS_URL;
    if (wsServerUrl) {
      try {
        await fetch(`${wsServerUrl}/broadcast-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "product-delete",
            data: {
              productId: product.id,
              productName: product.name,
              employeeId: product.assignedTo?.id,
              employeeName: product.assignedTo?.user?.name,
              createdAt: new Date().toISOString(),
              broadcastTo: {
                admin: true,
                employee: true
              }
            }
          })
        });
      } catch (err) {
        console.error("[WebSocket] Failed to emit product-delete event:", err);
      }
    }

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error deleting product:", error);
    return NextResponse.json({ error: "Failed to delete product" }, { status: 500 });
  }
}