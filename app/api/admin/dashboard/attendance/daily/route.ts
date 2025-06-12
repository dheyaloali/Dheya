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
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const days = Array.from({ length: daysInMonth }, (_, i) => i + 1);
    const attendanceByDay = await Promise.all(
      days.map(async (day) => {
        const start = new Date(year, month, day, 0, 0, 0, 0);
        const end = new Date(year, month, day, 23, 59, 59, 999);
        const records = await prisma.attendance.findMany({
          where: {
            date: {
              gte: start,
              lte: end,
            },
          },
        });
        // For demo, treat all as present (customize as needed)
        const presentCount = records.length;
        const lateCount = 0; // Add logic if you track late
        const absentCount = 0; // Add logic if you track absent
        return {
          day,
          presentCount,
          lateCount,
          absentCount,
        };
      })
    );
    return NextResponse.json(attendanceByDay);
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch attendance overview" }, { status: 500 });
  }
} 