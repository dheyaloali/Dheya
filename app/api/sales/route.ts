import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, true); // Only admin can list sales
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
    const { searchParams } = new URL(req.url);
  const employeeId = Number(searchParams.get("employeeId"));
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (employeeId && start && end) {
    const sales = await prisma.sale.findMany({
      where: {
        employeeId,
        date: {
          gte: new Date(start),
          lte: new Date(end),
        },
      },
      include: { product: true },
      orderBy: { date: "asc" },
    });
    return NextResponse.json(sales);
  }

  try {
    // If all=1, return all sales records with all relevant fields and relations
    if (searchParams.get('all') === '1') {
      // Build Prisma where clause for all filters
      const where: any = {};
      const city = searchParams.get('city');
      if (city && city !== 'all') {
        const cityList = city.split(',');
        where.employee = { city: { in: cityList } };
      }
      const status = searchParams.get('status');
      if (status && status !== 'all') {
        where.employee = { ...(where.employee || {}), status };
      }
      const from = searchParams.get('from');
      if (from) {
        where.date = { ...(where.date || {}), gte: new Date(from) };
      }
      const to = searchParams.get('to');
      if (to) {
        where.date = { ...(where.date || {}), lte: new Date(to) };
      }
      const productId = searchParams.get('productId');
      if (productId && productId !== 'all') {
        const productList = productId.split(',').map(Number);
        where.productId = { in: productList };
      }
      const employeeId = searchParams.get('employeeId');
      if (employeeId && employeeId !== 'all') {
        const employeeList = employeeId.split(',').map(Number);
        where.employeeId = { in: employeeList };
      }
      // Pagination
      const page = parseInt(searchParams.get('page') || '1', 10);
      const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
      const total = await prisma.sale.count({ where });
      const sales = await prisma.sale.findMany({
        where,
        include: {
          product: true,
          employee: { include: { user: true } }
        },
        orderBy: { date: 'desc' },
        skip: (page - 1) * pageSize,
        take: pageSize,
      });
      // Map sales to flat structure for frontend
      const result = sales.map(sale => {
            const dateObj = new Date(sale.date);
            return {
              id: sale.id,
              date: sale.date,
              year: dateObj.getFullYear(),
              month: dateObj.getMonth() + 1,
              amount: sale.amount,
              quantity: sale.quantity,
              notes: sale.notes,
              productId: sale.productId,
              product: sale.product?.name,
              productPrice: sale.product?.price,
              productDescription: sale.product?.description,
              employeeId: sale.employeeId,
              employee: sale.employee?.user?.name,
              employeeEmail: sale.employee?.user?.email,
              employeeCity: sale.employee?.city,
            };
      });
      return NextResponse.json({ sales: result, total });
    }
    // Add groupBy=employee support
    if (searchParams.get('groupBy') === 'employee') {
      const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
      const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
      const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
      const end = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);
      const where: any = { date: { gte: start, lt: end } };
      // Optional: filter by employeeId(s)
      const employeeIdParam = searchParams.get('employeeId');
      if (employeeIdParam && employeeIdParam !== 'all') {
        const employeeIds = employeeIdParam.split(',').map(Number);
        where["employeeId"] = { in: employeeIds };
      }
      // Group by employeeId
      const grouped = await prisma.sale.groupBy({
        by: ['employeeId'],
        where,
        _sum: { amount: true },
      });
      // Return as array of { employeeId, totalSales }
      return NextResponse.json({ totals: grouped.map(g => ({ employeeId: g.employeeId, totalSales: g._sum.amount || 0 })) });
    }
    const year = searchParams.get('year') ? parseInt(searchParams.get('year')!) : new Date().getFullYear();
    const month = searchParams.get('month') ? parseInt(searchParams.get('month')!) : undefined;
    const productIdParam = searchParams.get('productId') || undefined;
    const employeeIdParam = searchParams.get('employeeId') || undefined;

    // Debug logging
    console.log('[API /api/sales] Query params:', { year, month, productId: productIdParam, employeeId: employeeIdParam });

    // Build date range
    const start = month ? new Date(year, month - 1, 1) : new Date(year, 0, 1);
    const end = month ? new Date(year, month, 1) : new Date(year + 1, 0, 1);

    // Build where clause
    const where: any = { date: { gte: start, lt: end }, };
    // Support multi-select productId
    if (productIdParam && productIdParam !== 'all') {
      const productIds = productIdParam.split(',').map(Number);
      where.productId = { in: productIds };
    }
    // Support multi-select employeeId
    if (employeeIdParam && employeeIdParam !== 'all') {
      const employeeIds = employeeIdParam.split(',').map(Number);
      where.employeeId = { in: employeeIds };
    }

    // Fetch all products for mapping
    const products = await prisma.product.findMany();
    const productMap = Object.fromEntries(products.map(p => [p.id, p.name]));

    // Fetch sales
    const sales = await prisma.sale.findMany({
      where,
      select: {
        productId: true,
        amount: true,
        date: true,
      },
      orderBy: { date: "asc" },
    });

    // Group sales by product and by month/year
    const grouped: Record<string, Record<string, number>> = {};
    // Initialize all products with zero sales
    products.forEach(p => {
      grouped[p.name] = {};
    });
    
    sales.forEach(sale => {
      const product = productMap[sale.productId] || 'Unknown';
      const saleDate = new Date(sale.date);
      const y = saleDate.getFullYear();
      const m = saleDate.getMonth() + 1;
      const key = `${y}-${m}`;
      if (!grouped[product]) grouped[product] = {};
      if (!grouped[product][key]) grouped[product][key] = 0;
      grouped[product][key] += sale.amount;
    });

    // Flatten to array
    const result = [];
    for (const product in grouped) {
      for (const key in grouped[product]) {
        const [year, month] = key.split('-').map(Number);
        result.push({
          product,
          year,
          month,
          totalSales: grouped[product][key],
        });
      }
    }

    // Debug logging
    console.log('[API /api/sales] Result:', result);

    return NextResponse.json(result);
  } catch (error) {
    console.error("GET /api/sales error:", error);
    return NextResponse.json({ error: "Failed to fetch sales" }, { status: 500 });
  }
} 