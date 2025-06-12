import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export async function GET(request: Request) {
  // Require admin authorization
  const authResult = await requireAuth(request, true);
  
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.message }, { status: authResult.status });
  }
  
  try {
    const { searchParams } = new URL(request.url);
    const employeeId = searchParams.get('employeeId');
    const startDate = searchParams.get('startDate');
    const endDate = searchParams.get('endDate');
    const page = parseInt(searchParams.get('page') || '1', 10);
    const pageSize = parseInt(searchParams.get('pageSize') || '10', 10);
    const orderBy = searchParams.get('orderBy') || 'asc';
    
    // Validate required parameters
    if (!employeeId) {
      return NextResponse.json({ error: 'Employee ID is required' }, { status: 400 });
    }
    
    if (!startDate || !endDate) {
      return NextResponse.json({ error: 'Start and end dates are required' }, { status: 400 });
    }
    
    // Validate pagination parameters
    if (isNaN(page) || page < 1) {
      return NextResponse.json({ error: 'Invalid page parameter' }, { status: 400 });
    }
    
    if (isNaN(pageSize) || pageSize < 1 || pageSize > 100) {
      return NextResponse.json({ error: 'Invalid pageSize parameter (must be between 1 and 100)' }, { status: 400 });
    }
    
    // Validate orderBy parameter
    if (orderBy !== 'asc' && orderBy !== 'desc') {
      return NextResponse.json({ error: 'Invalid orderBy parameter (must be "asc" or "desc")' }, { status: 400 });
    }

    // Convert employeeId to number
    const employeeIdNumber = parseInt(employeeId, 10);
    if (isNaN(employeeIdNumber)) {
      return NextResponse.json({ error: 'Invalid employee ID format' }, { status: 400 });
    }
    
    // Validate date parameters
    let startDateObj: Date, endDateObj: Date;
    try {
      startDateObj = new Date(startDate);
      endDateObj = new Date(endDate);
      
      if (isNaN(startDateObj.getTime()) || isNaN(endDateObj.getTime())) {
        throw new Error('Invalid date format');
      }
      
      // Ensure start date is before end date
      if (startDateObj > endDateObj) {
        return NextResponse.json({ error: 'Start date must be before end date' }, { status: 400 });
      }
    } catch (error) {
      return NextResponse.json({ error: 'Invalid date format' }, { status: 400 });
    }
    
    // Check if employee exists
    const employee = await prisma.employee.findFirst({
      where: {
        id: employeeIdNumber,
      },
    });
    
    if (!employee) {
      return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
    }
    
    // Build time filter
    let timeFilter: any = {};
    if (startDateObj) {
      timeFilter.gte = startDateObj;
    }
    if (endDateObj) {
      timeFilter.lte = endDateObj;
    }
    
    // Get total count for pagination
    const total = await prisma.employeeLocation.count({
      where: {
        employeeId: employeeIdNumber,
        ...(Object.keys(timeFilter).length > 0 ? { timestamp: timeFilter } : {}),
      },
    });

    // Paginated query
    const locations = await prisma.employeeLocation.findMany({
      where: {
        employeeId: employeeIdNumber,
        ...(Object.keys(timeFilter).length > 0 ? { timestamp: timeFilter } : {}),
      },
      orderBy: {
        timestamp: orderBy as 'asc' | 'desc',
      },
      skip: (page - 1) * pageSize,
      take: pageSize,
      select: {
        id: true,
        latitude: true,
        longitude: true,
        timestamp: true,
        batteryLevel: true,
        address: true,
      }
    });

    // Return with cache control headers
    return NextResponse.json(
      { locations, total },
      {
        headers: {
          'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
          'Pragma': 'no-cache',
          'Expires': '0',
          'Surrogate-Control': 'no-store'
        }
      }
    );
  } catch (error) {
    console.error('Error fetching location history:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch location history',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}