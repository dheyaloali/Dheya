import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { requireAuth } from "@/lib/auth-guard";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const { searchParams } = new URL(req.url);
  const employeeId = Number(searchParams.get("employeeId"));
  const start = searchParams.get("start");
  const end = searchParams.get("end");

  if (!employeeId || !start || !end) {
    return NextResponse.json([], { status: 200 });
  }

  const attendance = await prisma.attendance.findMany({
    where: {
      employeeId,
      date: {
        gte: new Date(start),
        lte: new Date(end),
      },
    },
    orderBy: { date: "asc" },
  });

  return NextResponse.json(attendance);
} 