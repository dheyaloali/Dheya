import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";
import { RateLimiterMemory } from 'rate-limiter-flexible';
import { sanitizeInput } from '@/lib/sanitizeInput';

// Define allowed cities for validation
const ALLOWED_CITIES = ["Jakarta", "Surabaya", "Bandung"];

// Create a rate limiter instance
const limiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per 1 minute
});

// Type definitions for clarity
interface Employee {
  id: number;
  city: string | null;
  pictureUrl: string | null;
  user: {
    name: string | null;
  };
}

interface SaleWithSum {
  employeeId: number;
  _sum: {
    amount: number | null;
  };
}

interface ProductSale {
  employeeId: number;
  productId: number;
  _sum: {
    amount: number | null;
    quantity: number | null;
  };
}

interface Product {
  id: number;
  name: string;
  imageUrl: string | null;
}

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting based on IP
    await limiter.consume(req.ip || 'anonymous');
  } catch {
    return NextResponse.json({ error: 'Too many requests' }, { status: 429 });
  }

  // Require admin authentication
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const { searchParams } = new URL(req.url);
    
    // Sanitize and validate the city parameter
    const rawCity = searchParams.get('city');
    const sanitizedCity = rawCity ? sanitizeInput(rawCity) : null;
    
    // Validate city against allowed list if provided (not 'All' or null)
    if (sanitizedCity && sanitizedCity !== 'All' && !ALLOWED_CITIES.includes(sanitizedCity)) {
      return NextResponse.json({ 
        error: "Invalid city parameter", 
        message: `City must be one of: ${ALLOWED_CITIES.join(', ')}, All, or empty` 
      }, { 
        status: 400,
        headers: { 'Cache-Control': 'no-store' }
      });
    }
    
    const limit = parseInt(searchParams.get('limit') || '10', 10);
    const offset = parseInt(searchParams.get('offset') || '0', 10);
    const now = new Date();
    const year = now.getFullYear();
    const startOfYear = new Date(year, 0, 1);
    const endOfYear = new Date(year + 1, 0, 1);

    // Step 1: Get total count for pagination (with city filter)
    const cityFilter = sanitizedCity && sanitizedCity !== 'All' ? { city: sanitizedCity } : {};
    
    // Get employees filtered by city if provided
    const employees = await prisma.employee.findMany({
      where: cityFilter,
      select: { id: true, city: true, user: { select: { name: true } }, pictureUrl: true },
    });
    
    const employeeIds = employees.map((e: Employee) => e.id);

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

    // Calculate total for pagination
    const allSales = await prisma.sale.groupBy({
      by: ['employeeId'],
      where: {
        employeeId: { in: employeeIds },
        date: { gte: startOfYear, lt: endOfYear },
      },
      _sum: { amount: true },
    });
    
    const totalCount = allSales.length;

    // If no top sales, return empty result
    if (topSales.length === 0) {
      return NextResponse.json({
        performers: [],
        total: totalCount
      }, {
        headers: {
          'Cache-Control': 'private, max-age=5, stale-while-revalidate=30'
        }
      });
    }

    // Only fetch employee info for top performers
    const topPerformerIds = topSales.map((sale: SaleWithSum) => sale.employeeId);
    const topEmployees = employees.filter((e: Employee) => topPerformerIds.includes(e.id));

    // Get top products for all top performers in a single query
    const allTopProductSales = await prisma.sale.groupBy({
      by: ['employeeId', 'productId'],
      where: {
        employeeId: { in: topPerformerIds },
        date: { gte: startOfYear, lt: endOfYear },
      },
      _sum: { amount: true, quantity: true },
    });

    // Process and organize top products by employee
    const topProductsByEmployee = new Map<number, ProductSale[]>();
    
    // Collect all product IDs to fetch
    const allProductIds = new Set<number>();
    
    // For each employee, find their top 3 products
    topPerformerIds.forEach((empId: number) => {
      const empProducts = allTopProductSales
        .filter((sale: ProductSale) => sale.employeeId === empId)
        .sort((a: ProductSale, b: ProductSale) => (b._sum.amount || 0) - (a._sum.amount || 0))
        .slice(0, 3); // Top 3 products
        
      topProductsByEmployee.set(empId, empProducts);
      
      // Collect product IDs for bulk fetching
      empProducts.forEach((p: ProductSale) => allProductIds.add(p.productId));
    });

    // Batch fetch all needed products
    const products = await prisma.product.findMany({
      where: { id: { in: Array.from(allProductIds) } },
      select: { id: true, name: true, imageUrl: true },
    });

    // Map productId to product info
    const productMap = new Map<number, { name: string; imageUrl?: string }>();
    products.forEach((p: Product) => productMap.set(p.id, { name: p.name, imageUrl: p.imageUrl || undefined }));

    // Build performers array
    const performers = topSales.map((sale: SaleWithSum) => {
      const employee = topEmployees.find((e: Employee) => e.id === sale.employeeId);
      const productSales = topProductsByEmployee.get(sale.employeeId) || [];
      
      const topProducts = productSales.map(ps => ({
        name: productMap.get(ps.productId)?.name || "Unknown",
        amount: ps._sum.amount || 0,
        quantity: ps._sum.quantity || 0,
        image: productMap.get(ps.productId)?.imageUrl,
      }));
      
      return {
        id: employee?.id,
        name: employee?.user.name,
        location: employee?.city || '',
        sales: sale._sum.amount || 0,
        topProducts,
        avatar: employee?.pictureUrl || '',
      };
    });

    // Add security headers to the response
    const securityHeaders = {
      'Cache-Control': 'private, max-age=5, stale-while-revalidate=30',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY'
    };

    return NextResponse.json({
      performers,
      total: totalCount
    }, {
      headers: securityHeaders
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch top performers data" },
      { status: 500 }
    );
  }
} 