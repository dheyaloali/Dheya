import { NextRequest, NextResponse } from "next/server";
import { getServerSession } from "next-auth";
import { authOptions } from '@/lib/auth';
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

// GET: Fetch all attendance records for the logged-in employee
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session!;
  const userEmail = session.user?.email;
  if (typeof userEmail !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const employee = await prisma.employee.findFirst({ where: { user: { email: userEmail } }, include: { user: true } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const records = await prisma.attendance.findMany({ where: { employeeId: employee.id }, orderBy: { date: "desc" } });
  return NextResponse.json(records);
}

// Helper to calculate work hours as a string
function calcWorkHours(checkIn: Date | null, checkOut: Date | null): string {
  if (!checkIn || !checkOut) return "0";
  const ms = checkOut.getTime() - checkIn.getTime();
  const hours = ms / (1000 * 60 * 60);
  return hours.toFixed(2);
}

// POST: Create a new attendance record (check-in)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session!;
  const userEmail = session.user?.email;
  if (typeof userEmail !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const employee = await prisma.employee.findFirst({ where: { user: { email: userEmail } }, include: { user: true } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const body = await req.json();
  const { date, checkIn, checkOut, notes } = body;
  const checkInDate = checkIn ? new Date(checkIn) : null;
  const checkOutDate = checkOut ? new Date(checkOut) : null;
  const workHours = calcWorkHours(checkInDate, checkOutDate);
  const record = await prisma.attendance.create({
    data: {
      employeeId: employee.id,
      date: new Date(date),
      checkIn: checkInDate,
      checkOut: checkOutDate,
      workHours,
      notes: notes || null,
    },
  });
  return NextResponse.json(record);
}

// PUT: Update an attendance record (check-out or edit)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session!;
  const userEmail = session.user?.email;
  if (typeof userEmail !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const employee = await prisma.employee.findFirst({ where: { user: { email: userEmail } }, include: { user: true } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const body = await req.json();
  const { id, checkIn, checkOut, notes } = body;
  const checkInDate = checkIn ? new Date(checkIn) : undefined;
  const checkOutDate = checkOut ? new Date(checkOut) : undefined;
  let workHours: string | undefined = undefined;
  if (checkInDate && checkOutDate) {
    workHours = calcWorkHours(checkInDate, checkOutDate);
  }
  const record = await prisma.attendance.update({
    where: { id },
    data: {
      checkIn: checkInDate,
      checkOut: checkOutDate,
      workHours,
      notes: notes || undefined,
    },
  });
  return NextResponse.json(record);
}

// DELETE: Remove an attendance record
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session!;
  const userEmail = session.user?.email;
  if (typeof userEmail !== "string") {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const employee = await prisma.employee.findFirst({ where: { user: { email: userEmail } }, include: { user: true } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const body = await req.json();
  const { id } = body;
  await prisma.attendance.delete({ where: { id } });
  return NextResponse.json({ success: true });
} 