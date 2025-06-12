import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const data = await req.json();

    // Create the product
    const product = await prisma.product.create({
      data,
      include: {
        assignedTo: {
          include: {
            user: true
          }
        }
      }
    });

    // Emit WebSocket event for product creation
    const wsServerUrl = process.env.WS_SERVER_URL || process.env.NEXT_PUBLIC_WS_URL;
    if (wsServerUrl) {
      try {
        await fetch(`${wsServerUrl}/broadcast-notification`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            event: "product-create",
            data: {
              productId: product.id,
              productName: product.name,
              employeeId: product.assignedTo?.id,
              employeeName: product.assignedTo?.user?.name,
              stockLevel: product.stockLevel,
              createdAt: new Date().toISOString(),
              broadcastTo: {
                admin: true,
                employee: true
              }
            }
          })
        });
      } catch (err) {
        console.error("[WebSocket] Failed to emit product-create event:", err);
      }
    }

    return NextResponse.json({ success: true, product });
  } catch (error) {
    console.error("Error creating product:", error);
    return NextResponse.json({ error: "Failed to create product" }, { status: 500 });
  }
} 