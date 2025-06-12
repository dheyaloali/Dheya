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
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 1);

    // Get all employees
    const employees = await prisma.employee.findMany({
      include: { user: true },
    });

    // Get today's attendance records
    const attendanceRecords = await prisma.attendance.findMany({
      where: {
        date: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: { employee: { include: { user: true } } },
    });

    // Map employeeId to attendance record
    const attendanceMap = new Map();
    for (const record of attendanceRecords) {
      attendanceMap.set(record.employeeId, record);
    }

    // Build response: one entry per employee
    const result = employees.map((emp) => {
      const attendance = attendanceMap.get(emp.id);
      let status = "Absent";
      let checkInTime = "-";
      if (attendance && attendance.checkIn && attendance.checkOut) {
        status = "Present";
        checkInTime = new Date(attendance.checkIn).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });
      }
      return {
        id: emp.id,
        name: emp.user?.name || "",
        city: emp.city,
        checkInTime,
        status,
      };
    });

    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch today's attendance" }, { status: 500 });
  }
} 