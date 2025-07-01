import { NextRequest, NextResponse } from "next/server";
import { prisma } from '@/lib/prisma';
import { requireAuth } from "@/lib/auth-guard";
import { rateLimit } from '@/lib/rate-limit';

// Rate limit configuration
const limiter = rateLimit({
  interval: 60 * 1000, // 1 minute
  uniqueTokenPerInterval: 500
});

export async function GET(req: NextRequest) {
  // Check authentication and admin status
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    // Rate limiting
    try {
      await limiter.check(10, 'REPORTS_API'); // 10 requests per minute
    } catch {
      return NextResponse.json({ error: "Too many requests" }, { status: 429 });
    }

    const searchParams = req.nextUrl.searchParams;
    const page = parseInt(searchParams.get('page') || '1');
    const pageSize = parseInt(searchParams.get('pageSize') || '10');
    const type = searchParams.get('type');
    const status = searchParams.get('status');
    const employeeId = searchParams.get('employeeId');
    const city = searchParams.get('city');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const onlyToday = searchParams.get('onlyToday') === 'true';

    // Validate numeric parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: "Invalid page parameter" }, { status: 400 });
    }
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: "Invalid pageSize parameter" }, { status: 400 });
    }

    // Build where clause with optimized date filtering
    const where: any = {};
    if (type && type !== 'all') where.type = type;
    if (status && status !== 'all') where.status = status;
    if (employeeId && employeeId !== 'all') {
      const employeeIdNum = parseInt(employeeId);
      if (isNaN(employeeIdNum)) {
        return NextResponse.json({ error: "Invalid employeeId parameter" }, { status: 400 });
      }
      where.employeeId = employeeIdNum;
    }
    if (city && city !== 'all') where.employee = { city };
    
    // Optimized date filtering
    if (onlyToday) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1);
      where.date = {
        gte: today,
        lt: tomorrow
      };
    } else if (startDate && endDate) {
      try {
        const start = new Date(startDate);
        const end = new Date(endDate);
        
        // Validate date range
        if (isNaN(start.getTime()) || isNaN(end.getTime())) {
          return NextResponse.json({ error: "Invalid date parameters" }, { status: 400 });
        }
        
        // Optimize date range query
        where.date = {
          gte: start,
          lte: end
        };
      } catch (error) {
        return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
      }
    }

    // Get total count for pagination (with index hint)
    const total = await prisma.report.count({
      where,
      // Use index hint for better performance
      // Note: Requires corresponding index in schema.prisma
      // @@index([type, status, date])
    });

    // Get paginated data with optimized query
    const reports = await prisma.report.findMany({
      where,
      include: {
        employee: {
          select: {
            user: {
              select: {
                name: true
              }
            },
            city: true
          }
        }
      },
      orderBy: {
        date: 'desc'
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      // Add index hints for better performance
      // Note: Requires corresponding indexes in schema.prisma
    });

    // Transform the data
    const transformedReports = reports.map(report => ({
      id: report.id,
      employeeId: report.employeeId,
      employeeName: report.employee.user.name,
      city: report.employee.city,
      type: report.type,
      status: report.status,
      details: report.details,
      notes: report.notes,
      date: report.date
    }));

    const response = {
      reports: transformedReports,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize)
    };

    return NextResponse.json(response, {
      headers: {
        'X-Cache': 'MISS',
        'Cache-Control': 'public, max-age=60' // Cache for 1 minute
      }
    });
  } catch (error) {
    console.error("Error fetching reports:", error);
    return NextResponse.json({ 
      error: "Failed to fetch reports",
      details: error instanceof Error ? error.message : "Unknown error"
    }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  // Check authentication and admin status
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }

  try {
    const body = await req.json();
    
    // Basic validation
    if (!body.employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }
    if (!body.type || !['time', 'absence', 'sales'].includes(body.type)) {
      return NextResponse.json({ error: 'Valid report type is required' }, { status: 400 });
    }
    if (!body.details) {
      return NextResponse.json({ error: 'Report details are required' }, { status: 400 });
    }
    
    const report = await prisma.report.create({
      data: body,
    });
    
    return NextResponse.json({
      success: true,
      message: 'Report created successfully',
      report
    });
  } catch (error) {
    console.error("Error creating report:", error);
    return NextResponse.json({ 
      error: 'Failed to create report',
      details: error instanceof Error ? error.message : "Unknown error" 
    }, { status: 500 });
  }
}
