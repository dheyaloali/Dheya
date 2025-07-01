import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma"; // Use singleton instance
import { requireAuth } from "@/lib/auth-guard";
import { RateLimiterMemory } from 'rate-limiter-flexible';

// Create a rate limiter instance
const limiter = new RateLimiterMemory({
  points: 100, // 100 requests
  duration: 60, // per 1 minute
});

// Types for clarity
interface EmployeeAttendance {
  id: number;
  name: string;
  city: string;
  checkInTime: string;
  status: string;
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
    // Set up date range for today
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // More efficient approach: Get all employees with their attendance in a single query
    const employeesWithAttendance = await prisma.employee.findMany({
      select: {
        id: true,
        city: true,
        user: {
          select: {
            name: true
          }
        },
        attendance: {
          where: {
            date: {
              gte: today,
              lt: tomorrow
            }
          },
          select: {
            checkIn: true,
            checkOut: true,
            status: true
          }
        }
      }
    }).catch(() => []);

    // Build the response with all information in one pass
    const result: EmployeeAttendance[] = employeesWithAttendance.map((emp: any) => {
      const attendance = emp.attendance && emp.attendance[0]; // Get today's attendance if exists
      
      let status = "Absent";
      let checkInTime = "-";
      
      if (attendance) {
        if (attendance.checkIn && attendance.checkOut) {
          status = "Present";
        } else if (attendance.checkIn) {
          status = "Late"; // If checked in but not checked out yet
        }
        
        if (attendance.checkIn) {
          checkInTime = new Date(attendance.checkIn).toLocaleTimeString([], { 
            hour: "2-digit", 
            minute: "2-digit" 
          });
        }
      }
      
      return {
        id: emp.id,
        name: emp.user?.name || "",
        city: emp.city,
        checkInTime,
        status,
      };
    });

    // Return with caching headers for better performance
    return NextResponse.json(result, {
      headers: {
        // Short caching time for attendance data which can change frequently
        'Cache-Control': 'private, max-age=5, stale-while-revalidate=30'
      }
    });
  } catch (error) {
    return NextResponse.json(
      { error: "Failed to fetch attendance data" },
      { status: 500 }
    );
  }
} 