import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  // Require admin authentication
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);
    const products = await prisma.product.findMany();
    const salesByProduct = await Promise.all(
      products.map(async (product) => {
        const sales = await prisma.sale.findMany({
          where: {
            productId: product.id,
            date: {
              gte: start,
              lt: end,
            },
          },
        });
        const totalSales = sales.reduce((sum, sale) => sum + sale.amount, 0);
        return {
          product: product.name,
          totalSales,
        };
      })
    );
    return NextResponse.json(salesByProduct);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sales by product" }, { status: 500 });
  }
} 