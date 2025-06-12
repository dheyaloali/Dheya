import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session!;
  const userId = (session.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID missing" }, { status: 400 });
  }
  const { searchParams } = new URL(req.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
  const skip = (page - 1) * pageSize;

  // Find the employee record
  const employee = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true }
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Build where clause for employeeProducts
  let where: any = { employeeId: employee.id };
  if (from && to) {
    where.assignedAt = { gte: new Date(from), lte: new Date(to) };
  }

  // Get total count for pagination
  const total = await prisma.employeeProduct.count({ where });

  // Fetch paginated products
  const employeeProducts = await prisma.employeeProduct.findMany({
    where,
    include: { product: true },
    orderBy: { assignedAt: "desc" },
    skip,
    take: pageSize,
  });

  // For each assignment, get the sold quantity for that day
  const products = await Promise.all(employeeProducts.map(async ep => {
    // Sum sales for this assignment (by employee, product, assignedAt date)
    const startOfDay = new Date(ep.assignedAt.getFullYear(), ep.assignedAt.getMonth(), ep.assignedAt.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(ep.assignedAt.getFullYear(), ep.assignedAt.getMonth(), ep.assignedAt.getDate(), 23, 59, 59, 999);
    const sales = await prisma.sale.aggregate({
      where: {
        employeeId: ep.employeeId,
        productId: ep.productId,
        date: { gte: startOfDay, lte: endOfDay },
      },
      _sum: { quantity: true },
    });
    const soldQuantity = sales._sum.quantity || 0;
    return {
      id: ep.product.id,
      name: ep.product.name,
      description: ep.product.description,
      price: ep.product.price,
      stock: ep.product.stockLevel,
      image: ep.product.imageUrl,
      quantity: ep.quantity,
      assignedAt: ep.assignedAt,
      status: ep.status,
      expiredQuantity: ep.expiredQuantity,
      soldQuantity,
    };
  }));
  return NextResponse.json({ products, total, page, pageSize });
}

export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session!;
  const userId = (session.user as any)?.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID missing" }, { status: 400 });
  }
  const { id, status, expiredQuantity } = await req.json();

  // Find the employee record
  const employee = await prisma.employee.findFirst({
    where: { userId },
    select: { id: true }
  });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  // Update the assignment (ensure employee owns it)
  const updated = await prisma.employeeProduct.updateMany({
    where: { id, employeeId: employee.id },
    data: { status, expiredQuantity },
  });

  if (updated.count === 0) {
    return NextResponse.json({ error: "Assignment not found or not owned by employee" }, { status: 404 });
  }

  return NextResponse.json({ success: true });
} 