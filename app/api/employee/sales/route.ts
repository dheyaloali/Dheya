import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from '@/lib/prisma';
import { notifyUserOrEmployee } from '@/lib/notifications';
import { consumeRateLimit } from '@/lib/rateLimiter';

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

// GET: List all sales for the logged-in employee
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session!;
  const userId = (session.user as any)?.id;
  const employee = await prisma.employee.findFirst({ where: { userId }, include: { user: true } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  // Pagination params
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const skip = (page - 1) * pageSize;
  // Parse month/year for target
  const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
  const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
  // Fetch sales target
  const targetRecord = await prisma.salesTarget.findFirst({
    where: { employeeId: employee.id, month, year },
  });
  const target = typeof targetRecord?.targetAmount === 'number' ? targetRecord.targetAmount : null;
  const total = await prisma.sale.count({ where: { employeeId: employee.id } });
  const sales = await prisma.sale.findMany({
    where: { employeeId: employee.id },
    orderBy: { date: "desc" },
    include: { product: true, assignment: true },
    skip,
    take: pageSize,
  });
  return NextResponse.json({ sales, page, pageSize, total, totalPages: Math.ceil(total / pageSize), target });
}

// GET: List assigned products for the logged-in employee
export async function GET_ASSIGNED_PRODUCTS(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session!;
  const userId = (session.user as any)?.id;
  const employee = await prisma.employee.findFirst({ where: { userId }, include: { employeeProducts: { include: { product: true } } } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const assignedProducts = employee.employeeProducts.map((ep: any) => ({ ...ep.product, quantity: ep.quantity }));
  return NextResponse.json({ products: assignedProducts });
}

// POST: Record one or more sales
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session!;
  const userId = (session.user as any)?.id;
  // Add rate limiting
  const rateLimitError = await consumeRateLimit(userId);
  if (rateLimitError) {
    return NextResponse.json({ error: rateLimitError }, { status: 429 });
  }
  const employee = await prisma.employee.findFirst({ where: { userId }, include: { user: true } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  let salesData;
  try {
    salesData = await req.json();
  } catch (err) {
    return NextResponse.json({ error: "Invalid request. Please contact support if this continues." }, { status: 400 });
  }
  if (!Array.isArray(salesData)) salesData = [salesData];
  // Fetch assigned product IDs
  const assignedProducts = await prisma.employeeProduct.findMany({ where: { employeeId: employee.id } });
  const assignedProductIds = assignedProducts.map((ep: { productId: number }) => ep.productId);
  // Move these inside the handler, before use
  const now = new Date();
  const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
  const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
  // Validate and create sales
  const created = [];
  const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
  for (const sale of salesData) {
    if (!sale.productId || sale.quantity === undefined || sale.amount === undefined) {
      return NextResponse.json({ error: "Missing required sale fields" }, { status: 400 });
    }
    if (!assignedProductIds.includes(Number(sale.productId))) {
      return NextResponse.json({ error: `Product ${sale.productId} is not assigned to you.` }, { status: 403 });
    }
    // Find the assignment for today
    const todayAssignment = await prisma.employeeProduct.findFirst({
      where: {
        employeeId: employee.id,
        productId: sale.productId,
        assignedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    if (!todayAssignment) {
      return NextResponse.json({ error: `No assignment found for product ${sale.productId} today.` }, { status: 400 });
    }
    if (sale.quantity < 0 || sale.quantity > todayAssignment.quantity) {
      return NextResponse.json({ error: `Quantity for product ${sale.productId} must be between 0 and ${todayAssignment.quantity}.` }, { status: 400 });
    }
    // Upsert today's sale for this product
    const existingSale = await prisma.sale.findFirst({
      where: {
        employeeId: employee.id,
        productId: sale.productId,
        date: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    let record;
    if (existingSale) {
      record = await prisma.sale.update({
        where: { id: existingSale.id },
        data: {
          quantity: sale.quantity,
          amount: sale.amount,
          notes: sale.notes || null,
          employeeProductId: todayAssignment.id,
        },
      });
    } else {
      record = await prisma.sale.create({
        data: {
          employeeId: employee.id,
          productId: sale.productId,
          quantity: sale.quantity,
          amount: sale.amount,
          date: now,
          notes: sale.notes || null,
          employeeProductId: todayAssignment.id,
        },
      });
    }
    created.push(record);

    // Emit WebSocket event for sale
    await emitWebSocketEvent('product-sold', {
      employeeId: employee.id,
      productId: sale.productId,
      quantity: sale.quantity
    });

    // --- Immediate status update logic ---
    // Find the assignment for today (local time midnight)
    const assignment = await prisma.employeeProduct.findFirst({
      where: {
        employeeId: employee.id,
        productId: sale.productId,
        assignedAt: {
          gte: startOfDay,
          lte: endOfDay,
        },
      },
    });
    console.log('Looking for assignment:', {
      employeeId: employee.id,
      productId: sale.productId,
      assignedAt: {
        gte: startOfDay,
        lte: endOfDay,
      },
    });
    console.log('Found assignment:', assignment);
    if (assignment) {
      // Sum all sales for this assignment for today (local time)
      const sales = await prisma.sale.aggregate({
        where: {
          employeeId: employee.id,
          productId: sale.productId,
          date: {
            gte: startOfDay,
            lte: endOfDay,
          },
        },
        _sum: { quantity: true },
      });
      const soldQuantity = sales._sum.quantity || 0;
      const expiredQuantity = assignment.quantity - soldQuantity;
      let status = assignment.status;
      if (soldQuantity === 0) {
        status = "expired";
      } else if (soldQuantity < assignment.quantity) {
        status = "partially_sold";
      } else if (soldQuantity === assignment.quantity) {
        status = "sold";
      }
      await prisma.employeeProduct.update({
        where: { id: assignment.id },
        data: {
          status,
          expiredQuantity: expiredQuantity > 0 ? expiredQuantity : 0,
        },
      });
      // Fetch product and admin for notification
      const product = await prisma.product.findUnique({ where: { id: sale.productId } });
      const admin = await prisma.user.findFirst({ where: { role: "admin" } });
      // Notify admin
      if (admin) {
        try {
          await notifyUserOrEmployee({
            userId: admin.id,
            type: "admin_sale_created",
            message: `Employee ${employee.user?.name || employee.user?.email} recorded a new sale: ${sale.amount} for product '${product?.name || 'Unknown Product'}' on ${now.toLocaleString()}.`,
            actionUrl: `/admin/employees/${employee.id}/details`,
            actionLabel: "View Employee",
          });
        } catch (notifyErr) {
          console.error("[Notification] Failed to notify admin of employee sale:", notifyErr);
        }
      }
      // Notify employee (confirmation)
      try {
        await notifyUserOrEmployee({
          employeeId: employee.id,
          type: "employee_sale_created",
          message: `You recorded a new sale: ${sale.amount} for product '${product?.name || 'Unknown Product'}' on ${now.toLocaleString()}.`,
          actionUrl: "/employee/sales",
          actionLabel: "View Sales",
        });
      } catch (notifyErr) {
        console.error("[Notification] Failed to notify employee of sale confirmation:", notifyErr);
      }
    }
    // --- End status update logic ---
  }
  return NextResponse.json({ success: true, sales: created });
} 