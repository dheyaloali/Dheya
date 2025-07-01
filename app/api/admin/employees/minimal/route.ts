import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

export async function GET(req: NextRequest) {
  try {
    // Require admin authentication
    const auth = await requireAuth(req, true);
    if (!auth.ok) {
      return NextResponse.json({ error: auth.message }, { status: auth.status });
    }

    // Parse query parameters
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
    const search = searchParams.get("search") || "";
    const city = searchParams.get("city") || "";
    const position = searchParams.get("position") || "";
    const status = searchParams.get("status") || "";
    const joinDate = searchParams.get("joinDate") || "";
    
    const skip = (page - 1) * pageSize;
    const take = pageSize;

    // Build where condition for search and filters
    let where: any = {};
    
    // Add search condition
    if (search) {
      where.OR = [
        { user: { name: { contains: search, mode: 'insensitive' } } },
        { user: { email: { contains: search, mode: 'insensitive' } } },
        { position: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }
    
    // Add filter conditions
    if (city && city !== "All") {
      where.city = city;
    }
    
    if (position && position !== "All") {
      where.position = position;
    }
    
    if (status && status !== "All") {
      where.user = {
        ...where.user,
        status: status,
      };
    }
    
    if (joinDate) {
      const date = new Date(joinDate);
      const nextDay = new Date(date);
      nextDay.setDate(date.getDate() + 1);
      
      where.joinDate = {
        gte: date,
        lt: nextDay,
      };
    }

    // Fetch employees with pagination - only minimal data needed for table
    const [employees, total] = await Promise.all([
      prisma.employee.findMany({
        where,
        select: {
          id: true,
          position: true,
          city: true,
          joinDate: true,
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              status: true,
              image: true,
            },
          },
        },
        orderBy: { joinDate: "desc" },
        skip,
        take,
      }),
      prisma.employee.count({ where }),
    ]);

    // Add cache control header for better performance
    const headers = new Headers();
    headers.set('Cache-Control', 'public, max-age=10'); // Cache for 10 seconds

    return NextResponse.json({
      employees,
      total,
      page,
      pageSize,
      pageCount: Math.ceil(total / pageSize),
    }, { headers });
    
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
} 