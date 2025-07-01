import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from '@/lib/prisma';
import { consumeRateLimit } from '@/lib/rateLimiter';
import { notifyUserOrEmployee } from "@/lib/notifications";
import { SessionWithAdmin } from "@/lib/types";
import { getAttendanceSettings, isWithinCheckInWindow, determineAttendanceStatus } from '@/lib/attendance-settings';

// Add at the top:
interface SessionWithAdmin {
  user?: {
    id?: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAdmin?: boolean;
    isApproved?: boolean;
  };
}

// GET: List all attendance records for the logged-in employee
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session as SessionWithAdmin;
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
  }
  const rateLimitError = await consumeRateLimit(userId);
  if (rateLimitError) {
    return NextResponse.json({ error: rateLimitError }, { status: 429 });
  }
  const employee = await prisma.employee.findFirst({ where: { userId }, include: { user: true } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  // Pagination and filtering
  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const skip = (page - 1) * pageSize;
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  let where: any = { employeeId: employee.id };
  if (from) {
    const fromDate = new Date(from);
    fromDate.setHours(0, 0, 0, 0);
    where.date = { ...(where.date || {}), gte: fromDate };
  }
  if (to) {
    const toDate = new Date(to);
    toDate.setHours(23, 59, 59, 999);
    where.date = { ...(where.date || {}), lte: toDate };
  }
  const total = await prisma.attendance.count({ where });
  const records = await prisma.attendance.findMany({
    where,
    orderBy: { date: "desc" },
    skip,
    take: pageSize,
  });
  return NextResponse.json({ records, total, serverNow: new Date().toISOString() });
}

// POST: Check-in (create today's attendance record or undo)
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session as SessionWithAdmin;
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
  }
  const rateLimitError = await consumeRateLimit(userId);
  if (rateLimitError) {
    return NextResponse.json({ error: rateLimitError }, { status: 429 });
  }
  const employee = await prisma.employee.findFirst({ where: { userId }, include: { user: true } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const { date, checkIn, notes, undo } = await req.json();
  const now = date ? new Date(date) : new Date();
  // Always use UTC midnight for the attendance 'date' field
  const utcMidnight = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 0, 0, 0, 0));
  // Normalize to start of today
  const start = new Date(utcMidnight); // UTC midnight
  const end = new Date(utcMidnight); end.setUTCHours(23, 59, 59, 999);
  // Find today's record
  const existing = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      date: { gte: start, lte: end },
    },
  });
  // --- UNDO LOGIC ---
  if (undo) {
    if (!existing || !existing.checkIn || existing.checkInUndone) {
      return NextResponse.json({ error: "Undo not allowed" }, { status: 403 });
    }
    // DELETE the row instead of just nulling checkIn
    await prisma.attendance.delete({ where: { id: existing.id } });
    // Notify admin of check-in undo
    const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
    if (adminUser) {
      await notifyUserOrEmployee({
        userId: adminUser.id,
        type: "employee_attendance_checkin_undone",
        message: `Employee ${employee.user.name || employee.user.email} has undone their check-in for ${new Date(utcMidnight).toLocaleDateString()}.`,
        actionUrl: `/admin/attendance?employeeId=${employee.id}`,
        actionLabel: "View Attendance",
      });
    }
    return NextResponse.json({ success: true, serverNow: new Date().toISOString() });
  }
  // --- NORMAL CHECK-IN LOGIC ---
  // Get attendance settings from database
  const attendanceSettings = await getAttendanceSettings();
  
  // Check if check-in is within allowed window
  if (!isWithinCheckInWindow(now, attendanceSettings)) {
    return NextResponse.json({ 
      error: `Check-in only allowed between ${attendanceSettings.checkInWindowStart} and ${attendanceSettings.checkInWindowEnd}` 
    }, { status: 403 });
  }
  
  // Determine attendance status based on check-in time
  const checkInTime = checkIn ? new Date(checkIn) : new Date();
  const attendanceStatus = determineAttendanceStatus(checkInTime, null, attendanceSettings);
  
  if (existing) {
    if (existing.checkIn || existing.checkInUndone) {
      return NextResponse.json({ error: "Check-in not allowed (already checked in or undo used)" }, { status: 403 });
    }
    // If record exists but no checkIn and not undone, allow check-in
    const updated = await prisma.attendance.update({
      where: { id: existing.id },
      data: { 
        checkIn: checkInTime, 
        checkInUndone: false, 
        status: attendanceStatus, 
        notes: notes || null, 
        date: utcMidnight 
      },
    });
    // Notify admin of check-in
    const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
    if (adminUser) {
      await notifyUserOrEmployee({
        userId: adminUser.id,
        type: "employee_attendance_checkin",
        message: `${employee.user.name || employee.user.email} checked in at ${new Date(updated.checkIn!).toLocaleTimeString()} on ${new Date(updated.date).toLocaleDateString()} (Status: ${attendanceStatus}).`,
        actionUrl: `/admin/attendance?employeeId=${employee.id}`,
        actionLabel: "View Attendance",
      });
    }
    return NextResponse.json({ ...updated, serverNow: new Date().toISOString() });
  }
  // Create new record for today
  const record = await prisma.attendance.create({
    data: {
      employeeId: employee.id,
      date: utcMidnight,
      checkIn: checkInTime,
      status: attendanceStatus,
      notes: notes || null,
    },
  });
  // Notify admin of check-in
  const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  if (adminUser) {
    await notifyUserOrEmployee({
      userId: adminUser.id,
      type: "employee_attendance_checkin",
      message: `${employee.user.name || employee.user.email} checked in at ${new Date(record.checkIn!).toLocaleTimeString()} on ${new Date(record.date).toLocaleDateString()} (Status: ${attendanceStatus}).`,
      actionUrl: `/admin/attendance?employeeId=${employee.id}`,
      actionLabel: "View Attendance",
    });
  }
  return NextResponse.json({ ...record, serverNow: new Date().toISOString() });
}

// PUT: Check-out (update today's attendance record or undo)
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  const session = auth.session as SessionWithAdmin;
  const userId = session.user?.id;
  if (!userId) {
    return NextResponse.json({ error: "User ID not found in session" }, { status: 401 });
  }
  const rateLimitError = await consumeRateLimit(userId);
  if (rateLimitError) {
    return NextResponse.json({ error: rateLimitError }, { status: 429 });
  }
  const employee = await prisma.employee.findFirst({ where: { userId }, include: { user: true } });
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }
  const { checkOut, notes, undo } = await req.json();
  const now = new Date();
  // Normalize to start/end of today
  const start = new Date(now); start.setHours(0, 0, 0, 0);
  const end = new Date(now); end.setHours(23, 59, 59, 999);
  const record = await prisma.attendance.findFirst({
    where: {
      employeeId: employee.id,
      date: { gte: start, lte: end },
    },
  });
  if (!record) {
    return NextResponse.json({ error: "No check-in found for today" }, { status: 404 });
  }
  // --- UNDO LOGIC ---
  if (undo) {
    if (!record.checkOut || record.checkOutUndone) {
      return NextResponse.json({ error: "Undo not allowed" }, { status: 403 });
    }
    // Only update checkOut and workHours
    await prisma.attendance.update({
      where: { id: record.id },
      data: { checkOut: null, workHours: null, checkOutUndone: true },
    });
    // Notify admin of check-out undo
    const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
    if (adminUser) {
      await notifyUserOrEmployee({
        userId: adminUser.id,
        type: "employee_attendance_checkout_undone",
        message: `${employee.user.name || employee.user.email} has undone their check-out for ${new Date(record.date).toLocaleDateString()}.`,
        actionUrl: `/admin/attendance?employeeId=${employee.id}`,
        actionLabel: "View Attendance",
      });
    }
    return NextResponse.json({ success: true, serverNow: new Date().toISOString() });
  }
  // --- NORMAL CHECK-OUT LOGIC ---
  if (record.checkOut || record.checkOutUndone) {
    return NextResponse.json({ error: "Check-out not allowed (already checked out or undo used)" }, { status: 403 });
  }
  // Calculate work hours
  const checkInDate = record.checkIn;
  const checkOutDate = checkOut ? new Date(checkOut) : new Date();
  const workHours = checkInDate && checkOutDate ? ((checkOutDate.getTime() - checkInDate.getTime()) / (1000 * 60 * 60)).toFixed(2) : null;
  const updated = await prisma.attendance.update({
    where: { id: record.id },
    data: {
      checkOut: checkOutDate,
      workHours,
      notes: notes || record.notes,
      checkOutUndone: false,
    },
  });
  // Notify admin of check-out
  const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
  const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  if (adminUser) {
    await notifyUserOrEmployee({
      userId: adminUser.id,
      type: "employee_attendance_checkout",
      message: `${employee.user.name || employee.user.email} checked out at ${new Date(updated.checkOut!).toLocaleTimeString()} on ${new Date(updated.date).toLocaleDateString()} (Worked ${workHours} hours).`,
      actionUrl: `/admin/attendance?employeeId=${employee.id}`,
      actionLabel: "View Attendance",
      sessionToken,
    });
  }
  // After attendance update
  const nowString = new Date().toLocaleString();
  // Notify admin with employee name
  await notifyUserOrEmployee({
    userId: adminUser.id,
    type: "admin_attendance_record_updated",
    message: `You updated the attendance record for ${employee.user?.name || employee.user?.email} for ${new Date(updated.date).toLocaleDateString()} on ${nowString}.`,
    actionUrl: `/admin/employees/${employee.id}/details`,
    actionLabel: "View Employee",
    broadcastToAdmin: true,
    broadcastToEmployee: false
  });

  // Notify employee with "you"
  await notifyUserOrEmployee({
    employeeId: employee.id,
    type: "employee_attendance_updated",
    message: `Admin updated your attendance record for ${new Date(updated.date).toLocaleDateString()} on ${nowString}.`,
    actionUrl: "/employee/attendance",
    actionLabel: "View Attendance",
    broadcastToEmployee: true,
    broadcastToAdmin: false
  });
  return NextResponse.json({ ...updated, serverNow: new Date().toISOString() });
} 