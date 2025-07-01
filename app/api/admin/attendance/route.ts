import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import { prisma } from "@/lib/prisma";
import { notifyUserOrEmployee } from "@/lib/notifications";

export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, true); // Admin only
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    // Pagination params
    const { searchParams } = new URL(req.url);
    const page = parseInt(searchParams.get("page") || "1", 10);
    const pageSize = parseInt(searchParams.get("pageSize") || "20", 10);
    const skip = (page - 1) * pageSize;
    // Filtering params
    const search = searchParams.get("search") || "";
    const status = searchParams.getAll("status");
    const fromDate = searchParams.get("fromDate");
    const toDate = searchParams.get("toDate");
    const city = searchParams.get("city");
    const employeeId = searchParams.get("employeeId");
    // When filtering for today, use local start and end of day
    const now = new Date();
    const startOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const endOfDay = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 23, 59, 59, 999);
    // Build where clause
    let where: any = {};
    if (search) {
      const or: any[] = [
        { employee: { user: { name: { contains: search } } } }
      ];
      if (!isNaN(Number(search)) && search.trim() !== "") {
        or.push({ employeeId: { equals: Number(search) } });
        or.push({ id: { equals: Number(search) } });
      }
      where.OR = or;
    }
    if (status && status.length > 0) {
      where.status = { in: status };
    }
    if (fromDate && toDate && fromDate === toDate) {
      // Convert local start/end of day to UTC for correct filtering
      const localStart = new Date(fromDate);
      localStart.setHours(0, 0, 0, 0);
      const localEnd = new Date(toDate);
      localEnd.setHours(23, 59, 59, 999);
      // Convert to UTC
      const startUTC = new Date(localStart.getTime() - localStart.getTimezoneOffset() * 60000);
      const endUTC = new Date(localEnd.getTime() - localEnd.getTimezoneOffset() * 60000);
      where.date = { gte: startUTC, lte: endUTC };
    } else {
      if (fromDate) {
        const localStart = new Date(fromDate);
        localStart.setHours(0, 0, 0, 0);
        const startUTC = new Date(localStart.getTime() - localStart.getTimezoneOffset() * 60000);
        where.date = { ...(where.date || {}), gte: startUTC };
      }
      if (toDate) {
        const localEnd = new Date(toDate);
        localEnd.setHours(23, 59, 59, 999);
        const endUTC = new Date(localEnd.getTime() - localEnd.getTimezoneOffset() * 60000);
        where.date = { ...(where.date || {}), lte: endUTC };
      }
    }
    if (employeeId && employeeId !== "All") {
      where.employeeId = Number(employeeId);
    }
    if (city && city !== "All") {
      if (!where.employee) where.employee = {};
      where.employee.city = city;
    }
    // Get total count (filtered)
    const total = await prisma.attendance.count({
      where
    });
    // Get paginated records (filtered)
    const records = await prisma.attendance.findMany({
      where,
      orderBy: { date: "desc" },
      skip,
      take: pageSize,
      select: {
        id: true,
        employeeId: true,
        date: true,
        checkIn: true,
        checkOut: true,
        notes: true,
        status: true,
        employee: {
          select: {
            city: true,
            user: {
              select: {
                name: true,
              },
            },
          },
        },
      },
    });
    // Map to a flat structure for the frontend
    const result = records.map((rec) => ({
      id: rec.id,
      employeeId: rec.employeeId,
      employeeName: rec.employee?.user?.name || "",
      city: rec.employee?.city || "",
      date: rec.date,
      checkIn: rec.checkIn,
      checkOut: rec.checkOut,
      status: rec.status || "",
      workHours: rec.checkIn && rec.checkOut ? ((new Date(rec.checkOut).getTime() - new Date(rec.checkIn).getTime()) / 3600000).toFixed(2) : "-",
      notes: rec.notes,
    }));
    return NextResponse.json({ records: result, total });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch attendance records" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { employeeId, date, checkIn, checkOut, status, notes } = await req.json();
    if (!employeeId || !date) {
      return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
    }
    const record = await prisma.attendance.create({
      data: {
        employeeId: Number(employeeId),
        date: new Date(date),
        checkIn: checkIn ? new Date(checkIn) : null,
        checkOut: checkOut ? new Date(checkOut) : null,
        notes: notes || null,
        status: status || "Present",
      },
    });

    // Notify employee of attendance record creation
    const employee = await prisma.employee.findUnique({
      where: { id: Number(employeeId) },
      include: { user: true }
    });
    if (employee) {
      // Notify the employee
      await notifyUserOrEmployee({
        employeeId: employee.id,
        type: "admin_attendance_record_created",
        message: `Admin created an attendance record for you for ${new Date(date).toLocaleDateString()} (Status: ${status || "Present"}).`,
        actionUrl: "/employee/attendance",
        actionLabel: "View Attendance",
        broadcastToEmployee: true,
      });

      // Notify the admin
      await notifyUserOrEmployee({
        userId: auth.userId,
        type: "admin_attendance_record_created",
        message: `You created an attendance record for ${employee.user.name || employee.user.email} for ${new Date(date).toLocaleDateString()} (Status: ${status || "Present"}).`,
        actionUrl: `/admin/employees/${employee.id}/details`,
        actionLabel: "View Employee",
        broadcastToAdmin: true,
      });
    }

    return NextResponse.json({ success: true, record });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create attendance record" }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { id, checkIn, checkOut, status, notes, date } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing attendance id" }, { status: 400 });
    }

    // Get the current record to compare changes
    const currentRecord = await prisma.attendance.findUnique({
      where: { id: Number(id) },
      include: { employee: { include: { user: true } } }
    });
    if (!currentRecord) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    const record = await prisma.attendance.update({
      where: { id: Number(id) },
      data: {
        checkIn: checkIn ? new Date(checkIn) : undefined,
        checkOut: checkOut ? new Date(checkOut) : undefined,
        status: status || undefined,
        notes: notes || undefined,
        date: date ? new Date(date) : undefined,
      },
    });

    // Notify employee of attendance record update
    await notifyUserOrEmployee({
      employeeId: currentRecord.employeeId,
      type: "employee_attendance_updated",
      message: `Admin updated your attendance record for ${new Date(currentRecord.date).toLocaleDateString()} on ${new Date().toLocaleString()}.`,
      actionUrl: "/employee/attendance",
      actionLabel: "View Attendance",
      sessionToken: auth.sessionToken,
      broadcastToEmployee: true,
    });

    await notifyUserOrEmployee({
      userId: auth.userId,
      type: "admin_attendance_record_updated",
      message: `You updated the attendance record for ${currentRecord.employee?.user?.name || currentRecord.employee?.user?.email} for ${new Date(currentRecord.date).toLocaleDateString()} on ${new Date().toLocaleString()}.`,
      actionUrl: `/admin/employees/${currentRecord.employeeId}/details`,
      actionLabel: "View Employee",
      sessionToken: auth.sessionToken,
      broadcastToAdmin: true,
    });

    return NextResponse.json({ success: true, record });
  } catch (error) {
    return NextResponse.json({ error: "Failed to update attendance record" }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { id } = await req.json();
    if (!id) {
      return NextResponse.json({ error: "Missing attendance id" }, { status: 400 });
    }

    // Get the record before deleting to notify employee
    const record = await prisma.attendance.findUnique({
      where: { id: Number(id) },
      include: { employee: { include: { user: true } } }
    });
    
    if (!record) {
      return NextResponse.json({ error: "Attendance record not found" }, { status: 404 });
    }

    // Delete the record immediately
    await prisma.attendance.delete({
      where: { id: Number(id) }
    });

    // Handle notification asynchronously (don't wait for it)
    setTimeout(async () => {
      try {
        const now = new Date().toLocaleString();
        // Notify employee
        await notifyUserOrEmployee({
          employeeId: record.employeeId,
          type: "employee_attendance_deleted",
          message: `Admin deleted your attendance record for ${new Date(record.date).toLocaleDateString()} on ${now}.`,
          actionUrl: "/employee/attendance",
          actionLabel: "View Attendance",
          broadcastToEmployee: true,
        });

        // Notify admin
        await notifyUserOrEmployee({
          userId: auth.userId,
          type: "admin_attendance_deleted",
          message: `You deleted the attendance record for ${record.employee?.user?.name || record.employee?.user?.email} for ${new Date(record.date).toLocaleDateString()} on ${now}.`,
          actionUrl: `/admin/employees/${record.employeeId}/details`,
          actionLabel: "View Employees",
          broadcastToAdmin: true,
        });
      } catch (error) {
        console.error(`[Attendance] Failed to send notification for deleted record ID: ${id}`, error);
      }
    }, 0);

    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete attendance record" }, { status: 500 });
  }
} 