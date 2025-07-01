import { NextRequest, NextResponse } from 'next/server'
import { requireAuth } from '@/lib/auth-guard'
import { prisma } from '@/lib/prisma'
import { rateLimit } from '@/lib/rate-limit'
// import { csrf } from '@/lib/csrf'
import { sanitize } from '@/lib/sanitize'
import { auditLog } from '@/lib/audit'
import crypto from 'crypto'

// Simple in-memory cache with TTL
const CACHE_TTL = 60 * 1000; // 1 minute
const cache = new Map<string, { data: any, timestamp: number }>();

// Logger for error tracking
const logger = {
  error: (message: string, error: any) => {
    // TODO: Add your preferred logging service here
  }
};

// Generate ETag for caching
function generateETag(data: any): string {
  return crypto
    .createHash('md5')
    .update(JSON.stringify(data))
    .digest('hex')
}

export async function GET(req: NextRequest) {
  try {
    // Apply rate limiting with proper error handling
    const rateLimitResult = await rateLimit(req, 100, 15 * 60);
    if (!rateLimitResult.success) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { 
          status: 429,
          headers: {
            'X-RateLimit-Limit': rateLimitResult.limit.toString(),
            'X-RateLimit-Remaining': rateLimitResult.remaining.toString(),
            'X-RateLimit-Reset': rateLimitResult.reset.toString()
          }
        }
      );
    }

    // Get authenticated user/session
    const authResult = await requireAuth(req)
    if (!authResult.ok || !authResult.session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }
    const userId = authResult.session.user.id

    // Check cache first
    const cacheKey = `dashboard_${userId}`;
    const cached = cache.get(cacheKey);
    if (cached && Date.now() - cached.timestamp < CACHE_TTL) {
      return NextResponse.json(cached.data);
    }

    // Optionally check for admin
    if (authResult.session.user.role === 'admin') {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get employee data with optimized query including sales target
    const employee = await prisma.employee.findUnique({
      where: { userId },
      select: {
        id: true,
        position: true,
        city: true,
        user: {
          select: { name: true }
        },
        salesTargets: {
          orderBy: [
            { year: 'desc' },
            { month: 'desc' }
          ],
          take: 1,
          select: {
            targetAmount: true,
            year: true,
            month: true
          }
        }
      }
    })

    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 })
    }

    // Get current date range
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1)
    const endOfMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999)

    // Use transaction for consistent data and optimized queries
    const [
      attendanceStats,
      salesStats,
      productStats,
      documentStats
    ] = await prisma.$transaction([
      // Attendance stats using aggregation
      prisma.attendance.groupBy({
        by: ['status'],
        where: {
          employeeId: employee.id,
          date: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        _count: true
      }),
      // Sales stats using aggregation
      prisma.sale.aggregate({
        where: {
          employeeId: employee.id,
          date: {
            gte: startOfMonth,
            lte: endOfMonth
          }
        },
        _sum: {
          amount: true
        }
      }),
      // Product stats using aggregation
      prisma.product.aggregate({
        where: {
          employees: {
            some: {
              employeeId: employee.id,
              status: "assigned"
            }
          }
        },
        _count: true
      }),
      // Document stats using aggregation
      prisma.document.groupBy({
        by: ['status'],
        where: {
          employeeId: employee.id
        },
        _count: true
      })
    ])

    // Calculate stats from aggregated data
    const stats = {
      attendance: {
        present: attendanceStats.find(s => s.status === 'Present')?._count || 0,
        absent: attendanceStats.find(s => s.status === 'Absent')?._count || 0,
        late: attendanceStats.find(s => s.status === 'Late')?._count || 0
      },
      sales: {
        total: salesStats._sum.amount || 0,
        target: employee.salesTargets[0]?.targetAmount || 0
      },
      products: {
        assigned: productStats._count || 0,
        sold: 0, // This needs a separate query if needed
        lowStock: 0 // This needs a separate query if needed
      },
      documents: {
        total: documentStats.reduce((sum, stat) => sum + stat._count, 0),
        pending: documentStats.find(s => s.status === 'pending')?._count || 0
      }
    }

    // Prepare response data
    const responseData = {
      employee: sanitize(employee),
      stats: sanitize(stats),
      serverNow: new Date().toISOString()
    };

    // Update cache
    cache.set(cacheKey, { data: responseData, timestamp: Date.now() });

    // Log the dashboard access
    await auditLog('dashboard_access', userId)

    // Return response with cache headers
    return NextResponse.json(responseData, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=30',
        'ETag': generateETag(responseData)
      }
    })
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch dashboard data" },
      { status: 500 }
    );
  }
} 