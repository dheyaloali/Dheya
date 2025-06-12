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
    const city = searchParams.get('city');
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    // Get employees filtered by city if provided
    const employees = await prisma.employee.findMany({
      where: city ? { city } : {},
      select: { id: true, city: true, user: { select: { name: true } }, pictureUrl: true },
    });
    const employeeIds = employees.map(e => e.id);

    // Fetch top performers by total sales (current year, filtered by city)
    const topSales = await prisma.sale.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startOfYear, lt: endOfYear },
      },
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
      take: limit,
      skip: offset,
    });

    // Fetch employee, user info, and top products for each top performer
    const performers = await Promise.all(
      topSales.map(async (sale) => {
        const employee = employees.find(e => e.id === sale.employeeId);
        // Find top 3 products for this employee
        const productSales = await prisma.sale.groupBy({
          by: ['productId'],
          where: {
            employeeId: sale.employeeId,
            date: { gte: startOfYear, lt: endOfYear },
          },
          _sum: { amount: true, quantity: true },
          orderBy: { _sum: { amount: 'desc' } },
          take: 3,
        });
        let topProducts: { name: string; amount: number; quantity: number; image?: string }[] = [];
        for (const ps of productSales) {
          const product = await prisma.product.findUnique({ where: { id: ps.productId } });
          if (product) {
            topProducts.push({
              name: product.name,
              amount: ps._sum.amount || 0,
              quantity: ps._sum.quantity || 0,
              image: product.imageUrl || undefined,
            });
          }
        }
        return {
          id: employee?.id,
          name: employee?.user.name,
          location: employee?.city || '',
          sales: sale._sum.amount || 0,
          topProducts,
          avatar: employee?.pictureUrl || '',
        };
      })
    );

    // Get total count for pagination
    const allSales = await prisma.sale.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startOfYear, lt: endOfYear },
      },
      _sum: { amount: true },
    });

    return NextResponse.json({
      performers,
      total: allSales.length,
    });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch top performers" }, { status: 500 });
  }
} 