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
    const period = searchParams.get('period') || 'monthly'; // 'monthly', 'quarterly', 'yearly'
    const limit = parseInt(searchParams.get('limit') || '10', 10); // Limit number of cities
    
    // Get all cities from employees
    const employees = await prisma.employee.findMany({ select: { city: true, id: true } });
    const cities = Array.from(new Set(employees.map(e => e.city).filter(Boolean)));
    
    // Limit cities if needed
    const limitedCities = limit > 0 ? cities.slice(0, limit) : cities;
    
    // Get sales for each city in a single query
    const salesByCity = await Promise.all(
      limitedCities.map(async (city) => {
        const employeeIds = employees.filter(e => e.city === city).map(e => e.id);
        
        // Get all sales for the year in a single query
        const sales = await prisma.sale.findMany({
          where: {
            employeeId: { in: employeeIds },
            date: {
              gte: new Date(year, 0, 1),
              lt: new Date(year + 1, 0, 1),
            },
          },
          select: {
            amount: true,
            date: true,
          },
        });
        
        // Group sales by period
        if (period === 'yearly') {
          // Just one data point for the whole year
          return {
            city,
            data: [{
              period: year.toString(),
              totalSales: sales.reduce((sum, sale) => sum + sale.amount, 0),
            }]
          };
        } else if (period === 'quarterly') {
          // Group by quarter
          const quarterlyData = Array.from({ length: 4 }, (_, quarter) => {
            const quarterSales = sales.filter(sale => {
              const saleDate = new Date(sale.date);
              const saleQuarter = Math.floor(saleDate.getMonth() / 3);
              return saleQuarter === quarter;
            });
            return {
              period: `Q${quarter + 1}`,
              totalSales: quarterSales.reduce((sum, sale) => sum + sale.amount, 0),
            };
          });
          
          return {
            city,
            data: quarterlyData,
          };
        } else {
          // Default: group by month
          const monthlyData = Array.from({ length: 12 }, (_, month) => {
            const monthSales = sales.filter(sale => {
              const saleDate = new Date(sale.date);
              return saleDate.getMonth() === month;
            });
            return {
              period: new Date(year, month, 1).toLocaleString('default', { month: 'short' }),
              totalSales: monthSales.reduce((sum, sale) => sum + sale.amount, 0),
            };
          });
          
          return {
            city,
            data: monthlyData,
          };
        }
      })
    );
    
    // Add cache control header
    return NextResponse.json(salesByCity, {
      headers: {
        'Cache-Control': 'private, max-age=300, stale-while-revalidate=600' // Cache for 5 minutes
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch sales by city data" },
      { status: 500 }
    );
  }
} 