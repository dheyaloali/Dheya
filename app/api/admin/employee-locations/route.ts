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
    const timeframe = searchParams.get('timeframe') || 'current';
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const city = searchParams.get('city');
    
    console.log("[API] Fetching employee locations. Params:", { timeframe, employeeId, status, city });
    
    // Validate employeeId if provided
    if (employeeId && isNaN(parseInt(employeeId))) {
      return NextResponse.json({ error: "Invalid employee ID format" }, { status: 400 });
    }
    
    // Validate timeframe
    if (!['current', 'today', 'week', 'custom'].includes(timeframe)) {
      return NextResponse.json({ error: "Invalid timeframe parameter" }, { status: 400 });
    }
    
    let timeFilter: any = {};
    let now = new Date();
    
    if (timeframe === 'today') {
      const startOfDay = new Date(now);
      startOfDay.setHours(0, 0, 0, 0);
      timeFilter = {
        timestamp: {
          gte: startOfDay,
        },
      };
    } else if (timeframe === 'week') {
      const startOfWeek = new Date(now);
      startOfWeek.setDate(now.getDate() - now.getDay());
      startOfWeek.setHours(0, 0, 0, 0);
      timeFilter = {
        timestamp: {
          gte: startOfWeek,
        },
      };
    } else if (timeframe === 'custom') {
      const startDate = searchParams.get('startDate');
      const endDate = searchParams.get('endDate');
      
      if (startDate && endDate) {
        try {
          const start = new Date(startDate);
          const end = new Date(endDate);
          
          // Validate date parameters
          if (isNaN(start.getTime()) || isNaN(end.getTime())) {
            return NextResponse.json({ error: "Invalid date parameters" }, { status: 400 });
          }
          
          timeFilter = {
            timestamp: {
              gte: start,
              lte: end,
            },
          };
        } catch (error) {
          return NextResponse.json({ error: "Invalid date format" }, { status: 400 });
        }
      }
    }
    
    // Build employee filter
    let employeeFilter: any = {};
    
    // Add employee ID filter if specified
    if (employeeId) {
      employeeFilter.id = parseInt(employeeId);
    }
    
    // Add city filter if specified and not "All"
    if (city && city !== 'All') {
      employeeFilter.city = city;
    }
    
    console.log("[API] Query filters:", { employeeFilter, timeFilter });
    
    // First, get all employees with their most recent locations
    const employees = await prisma.employee.findMany({
      where: employeeFilter,
      include: {
        locations: {
          where: timeFilter,
          orderBy: {
            timestamp: 'desc',
          },
          take: timeframe === 'current' ? 1 : undefined,
        },
        user: {
          select: {
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });
    
    console.log(`[API] Found ${employees.length} employees with ${employees.reduce((sum: number, emp: any) => sum + emp.locations.length, 0)} location entries`);
    
    // Filter by status if requested
    let filteredEmployees = employees;
    if (status && status !== 'all') {
      filteredEmployees = employees.filter(emp => emp.user.status === status.toUpperCase());
    }
    
    // Make sure each employee has the required structure for the UI
    const mappedEmployees = filteredEmployees.map((emp: any) => {
      // Define a basic employee structure
      const employee = {
        id: emp.id.toString(),
        name: emp.user?.name || "Unknown",
        city: emp.city,
        department: emp.position,
        user: {
          name: emp.user?.name,
          email: emp.user?.email,
          status: emp.user?.status
        }
      };
      
      // Add location data if available
      if (emp.locations && emp.locations.length > 0) {
        const primaryLocation = emp.locations[0];
        return {
          ...employee,
          location: {
            latitude: primaryLocation.latitude,
            longitude: primaryLocation.longitude,
            timestamp: primaryLocation.timestamp.toISOString(),
          },
          batteryLevel: primaryLocation.batteryLevel || 0,
          locations: emp.locations.map((loc: any) => ({
            latitude: loc.latitude,
            longitude: loc.longitude,
            timestamp: loc.timestamp.toISOString(),
            batteryLevel: loc.batteryLevel || 0,
            address: loc.address || null
          }))
        };
      }
      
      return employee;
    });
    
    // Filter out employees without location data if in real-time mode
    const employeesWithLocation = timeframe === 'current' 
      ? mappedEmployees.filter(emp => emp.location)
      : mappedEmployees;
    
    console.log(`[API] Returning ${employeesWithLocation.length} employees with location data`);
    
    // Return with cache control headers
    return NextResponse.json(employeesWithLocation, {
      headers: {
        'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
        'Pragma': 'no-cache',
        'Expires': '0',
        'Surrogate-Control': 'no-store'
      }
    });
  } catch (error) {
    console.error('Error fetching employee locations:', error);
    return NextResponse.json(
      { 
        error: 'Failed to fetch employee locations',
        details: error instanceof Error ? error.message : 'Unknown error'
      }, 
      { status: 500 }
    );
  }
}