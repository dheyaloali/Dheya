import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { Sale } from "@prisma/client";

interface SaleWithProduct extends Sale {
  product?: {
    name: string;
  } | null;
}

interface ProductSalesData {
  period: string;
  totalSales: number;
}

interface ProductSales {
  product: string;
  data: ProductSalesData[];
  totalSales?: number;
}

export async function GET(req: NextRequest) {
  // Require admin authentication
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { searchParams } = new URL(req.url);
    const year = parseInt(searchParams.get('year') || `${new Date().getFullYear()}`, 10);
    const period = searchParams.get('period') || 'yearly'; // 'monthly', 'quarterly', 'yearly'
    const limit = parseInt(searchParams.get('limit') || '10', 10); // Limit number of products
    const start = new Date(year, 0, 1);
    const end = new Date(year + 1, 0, 1);

    // Get all sales for the year in a single query with product information
    const sales = await prisma.sale.findMany({
      where: {
        date: {
          gte: start,
          lt: end,
        },
      },
      include: {
        product: {
          select: {
            name: true,
          },
        },
      },
    }) as SaleWithProduct[];

    if (period === 'yearly') {
      // Group sales by product for the whole year
      const salesByProduct = sales.reduce((acc: Record<string, number>, sale: SaleWithProduct) => {
        const productName = sale.product?.name || 'Unknown';
        if (!acc[productName]) {
          acc[productName] = 0;
        }
        acc[productName] += sale.amount;
        return acc;
      }, {} as Record<string, number>);

      // Transform to array format and sort by sales
      const result = Object.entries(salesByProduct)
        .map(([product, totalSales]) => ({
          product,
          totalSales,
        }))
        .sort((a, b) => b.totalSales - a.totalSales)
        .slice(0, limit > 0 ? limit : undefined);

      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' // Cache for 5 minutes
        }
      });
    } else {
      // Group by product first
      const productSales: Record<string, ProductSales> = {};
      
      // Initialize all products
      sales.forEach((sale: SaleWithProduct) => {
        const productName = sale.product?.name || 'Unknown';
        if (!productSales[productName]) {
          productSales[productName] = {
            product: productName,
            data: []
          };
        }
      });
      
      // Group by period
      if (period === 'quarterly') {
        // Initialize quarterly data for each product
        Object.keys(productSales).forEach(productName => {
          productSales[productName].data = Array.from({ length: 4 }, (_, i) => ({
            period: `Q${i + 1}`,
            totalSales: 0
          }));
        });
        
        // Aggregate sales by product and quarter
        sales.forEach((sale: SaleWithProduct) => {
          const productName = sale.product?.name || 'Unknown';
          const saleDate = new Date(sale.date);
          const quarter = Math.floor(saleDate.getMonth() / 3);
          productSales[productName].data[quarter].totalSales += sale.amount;
        });
      } else {
        // Monthly data
        Object.keys(productSales).forEach(productName => {
          productSales[productName].data = Array.from({ length: 12 }, (_, i) => ({
            period: new Date(year, i, 1).toLocaleString('default', { month: 'short' }),
            totalSales: 0
          }));
        });
        
        // Aggregate sales by product and month
        sales.forEach((sale: SaleWithProduct) => {
          const productName = sale.product?.name || 'Unknown';
          const saleDate = new Date(sale.date);
          const month = saleDate.getMonth();
          productSales[productName].data[month].totalSales += sale.amount;
        });
      }
      
      // Convert to array and sort by total sales
      const result = Object.values(productSales)
        .map(item => ({
          ...item,
          totalSales: item.data.reduce((sum, period) => sum + period.totalSales, 0)
        }))
        .sort((a, b) => (b.totalSales || 0) - (a.totalSales || 0))
        .slice(0, limit > 0 ? limit : undefined);
      
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' // Cache for 5 minutes
        }
      });
    }
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sales by product data" },
      { status: 500 }
    );
  }
} 