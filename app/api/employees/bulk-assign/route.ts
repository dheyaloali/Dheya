import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { notifyUserOrEmployee } from "@/lib/notifications";

// Helper function to emit WebSocket event
async function emitWebSocketEvent(event: string, data: any) {
  const wsServerUrl = process.env.WS_SERVER_URL;
  if (!wsServerUrl) {
    console.log("[WebSocket] WS_SERVER_URL not set, skipping event emission");
    return;
  }
  try {
    await fetch(`${wsServerUrl}/broadcast-notification`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ event, data }),
    });
  } catch (err) {
    console.error(`[WebSocket] Failed to emit ${event} event:`, err);
  }
}

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
    const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
    for (const empId of employeeIds) {
      const now = new Date();
      const localMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
      const utcMidnight = new Date(localMidnight.getTime() - (localMidnight.getTimezoneOffset() * 60000));
      for (const { productId, quantity } of assignments) {
        const existingAssignment = await prisma.employeeProduct.findFirst({
          where: {
            employeeId: empId,
            productId,
            assignedAt: utcMidnight,
          },
        });

        if (existingAssignment) {
          // Update existing assignment
          await prisma.employeeProduct.update({
            where: { id: existingAssignment.id },
            data: { quantity },
          });
          // Emit WebSocket event for update
          await emitWebSocketEvent('product-updated', {
            employeeId: empId,
            productId,
            quantity
          });
        } else {
          // Create new assignment
          await prisma.employeeProduct.create({
            data: {
              employeeId: empId,
              productId,
              quantity,
              assignedAt: utcMidnight,
            },
          });
          // Emit WebSocket event for new assignment
          await emitWebSocketEvent('product-assigned', {
            employeeId: empId,
            productId,
            quantity
          });
        }

        // Notify employee of bulk assignment
        try {
          const product = await prisma.product.findUnique({ where: { id: productId } });
          await notifyUserOrEmployee({
            employeeId: empId,
            type: "product_assignment_bulk",
            message: `You have been assigned product '${product?.name || productId}' (quantity ${quantity}) by the admin (bulk action).`,
            actionUrl: "/employee/product",
            actionLabel: "View Products",
            sessionToken,
            broadcastToEmployee: true,
          });
        } catch (notifyErr) {
          console.error("[Notification] Failed to notify employee of bulk assignment:", notifyErr);
        }
      }
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    console.error("Error in bulk assignment:", error);
    return NextResponse.json({ error: "Bulk assignment failed", details: String(error) }, { status: 500 });
  }
} 