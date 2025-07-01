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

    const { searchParams } = new URL(req.url);
    const search = searchParams.get('search') || '';
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const city = searchParams.get('city');
    const status = searchParams.get('status');
    const sortBy = searchParams.get('sortBy') || 'name';
    const sortOrder = searchParams.get('sortOrder') || 'asc';

    // Build the where clause
    const where: any = {
      user: {
        name: {
          contains: search,
          mode: 'insensitive'
        },
        ...(status ? { status } : {})
      },
      ...(city ? { city } : {})
    };

    // Get total count for pagination
    const total = await prisma.employee.count({ where });

    // Get employees with pagination and sorting
    const employees = await prisma.employee.findMany({
      where,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            image: true
          }
        }
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      orderBy: {
        user: {
          name: sortOrder as 'asc' | 'desc'
        }
      }
    });

    return NextResponse.json({
      employees,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch employees" },
      { status: 500 }
    );
  }
} 