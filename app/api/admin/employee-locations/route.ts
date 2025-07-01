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
    const timeframe = searchParams.get('timeframe') || 'today';
    const employeeId = searchParams.get('employeeId');
    const status = searchParams.get('status');
    const city = searchParams.get('city');
    
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
    
    // Add status filter if specified and not "all"
    if (status && status !== 'all') {
      employeeFilter.user = {
        status: status.toUpperCase()
      };
    }
    
    // Optimize the query by using a more efficient approach
    // First, get all employees based on filters
    const employees = await prisma.employee.findMany({
      where: employeeFilter,
      include: {
        user: {
          select: {
            name: true,
            email: true,
            status: true,
          },
        },
      },
    });
    
    // Get employee IDs for location query
    const employeeIds = employees.map(emp => emp.id);
    
    // Then, use a separate optimized query to get the most recent locations
    // This will leverage the composite index (employeeId, timestamp)
    const locationsQuery = timeframe === 'current'
      ? // For current timeframe, get only the most recent location per employee
        Promise.all(employeeIds.map(async (empId) => {
          return prisma.employeeLocation.findFirst({
            where: {
              employeeId: empId,
              ...timeFilter
            },
            orderBy: {
              timestamp: 'desc'
            },
          });
        }))
      : // For other timeframes, get all locations in the time range
        prisma.employeeLocation.findMany({
          where: {
            employeeId: {
              in: employeeIds
            },
            ...timeFilter
          },
          orderBy: {
            timestamp: 'desc'
          }
        });
    
    // Execute the location query
    const locations = await locationsQuery;
    
    // Create a map of employee ID to locations
    const locationMap = new Map();
    
    if (timeframe === 'current') {
      // For current timeframe, we have one location per employee (or null)
      locations.forEach((loc) => {
        if (loc) {
          if (!locationMap.has(loc.employeeId)) {
            locationMap.set(loc.employeeId, [loc]);
          }
        }
      });
    } else {
      // For other timeframes, group locations by employee ID
      (locations as any[]).forEach((loc) => {
        if (!locationMap.has(loc.employeeId)) {
          locationMap.set(loc.employeeId, []);
        }
        locationMap.get(loc.employeeId).push(loc);
      });
    }
    
    // Map employees with their locations
    const mappedEmployees = employees.map((emp) => {
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
      const employeeLocations = locationMap.get(emp.id) || [];
      
      if (employeeLocations.length > 0) {
        const primaryLocation = employeeLocations[0];
        return {
          ...employee,
          location: {
            latitude: primaryLocation.latitude,
            longitude: primaryLocation.longitude,
            timestamp: primaryLocation.timestamp.toISOString(),
          },
          batteryLevel: primaryLocation.batteryLevel || 0,
          locations: employeeLocations.map((loc: any) => ({
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
    // Handle error
    return NextResponse.json({ error: 'Failed to fetch employee locations' }, { status: 500 });
  }
}