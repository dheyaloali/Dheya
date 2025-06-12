import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  // Require admin authentication
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);
    // Get all cities
    const employees = await prisma.employee.findMany({ select: { city: true, id: true } });
    const cities = Array.from(new Set(employees.map(e => e.city).filter(Boolean)));
    const products = await prisma.product.findMany();

    const result = await Promise.all(
      cities.map(async (city) => {
        const employeeIds = employees.filter(e => e.city === city).map(e => e.id);
        const productMonthly = await Promise.all(
          products.map(async (product) => {
            // For each month, get quantity
            const monthly = await Promise.all(
              Array.from({ length: 12 }, (_, month) => {
                const start = new Date(year, month, 1);
                const end = new Date(year, month + 1, 1);
                return prisma.sale.findMany({
                  where: {
                    employeeId: { in: employeeIds },
                    productId: product.id,
                    date: { gte: start, lt: end },
                  },
                });
              })
            );
            return {
              name: product.name,
              monthly: monthly.map((sales, month) => ({
                month: new Date(year, month, 1).toLocaleString('default', { month: 'short' }),
                quantity: sales.reduce((sum, sale) => sum + sale.quantity, 0),
              })),
            };
          })
        );
        return {
          city,
          products: productMonthly,
        };
      })
    );
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch products sold by city" }, { status: 500 });
  }
} 