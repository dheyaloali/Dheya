import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";
import { notifyUserOrEmployee } from "@/lib/notifications";

// GET: List all reports for the logged-in employee (paginated, filterable)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const employee = await prisma.employee.findFirst({ where: { userId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { searchParams } = new URL(req.url);
  const page = parseInt(searchParams.get("page") || "1");
  const pageSize = parseInt(searchParams.get("pageSize") || "10");
  const type = searchParams.get("type");
  const status = searchParams.get("status");
  const startDate = searchParams.get("startDate");
  const endDate = searchParams.get("endDate");

  const where: any = { employeeId: employee.id };
  if (type && type !== "all") where.type = type;
  if (status && status !== "all") where.status = status;
  if (startDate && endDate) {
    where.date = { gte: new Date(startDate), lte: new Date(endDate) };
  }

  const total = await prisma.report.count({ where });
  const reports = await prisma.report.findMany({
    where,
    orderBy: { date: "desc" },
    skip: (page - 1) * pageSize,
    take: pageSize,
  });

  return NextResponse.json({
    reports,
    total,
    page,
    pageSize,
    totalPages: Math.ceil(total / pageSize),
  });
}

// POST: Create a new report for the logged-in employee
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  const userId = session.user.id;
  const employee = await prisma.employee.findFirst({ where: { userId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const { type, notes } = await req.json();
  if (!type) return NextResponse.json({ error: "Type is required" }, { status: 400 });

  const report = await prisma.report.create({
    data: {
      employeeId: employee.id,
      type,
      notes,
      status: "pending",
      date: new Date(),
      details: {},
    },
  });

  // Notify admin
  const adminUser = await prisma.user.findFirst({ where: { role: "admin" } });
  const user = await prisma.user.findUnique({ where: { id: employee.userId } });
  const sessionToken = req.cookies?.get?.('next-auth.session-token')?.value || req.cookies?.get?.('next-auth.session-token.0')?.value || req.cookies?.['next-auth.session-token'];
  if (adminUser) {
    const now = new Date(report.date).toLocaleDateString();
    await notifyUserOrEmployee({
      userId: adminUser.id,
      type: "admin_report_submitted",
      message: `Employee ${user?.name || employee.id} (${user?.email || "no email"}) submitted a new '${type.charAt(0).toUpperCase() + type.slice(1)}' report on ${now}.`,
      actionUrl: `/admin/employees/${employee.id}/details`,
      actionLabel: "View Employee",
      sessionToken,
    });
  }

  // Notify employee (confirmation)
  const now = new Date(report.date).toLocaleDateString();
  await notifyUserOrEmployee({
    employeeId: employee.id,
    type: "employee_report_submitted",
    message: `You submitted a new report: '${type.charAt(0).toUpperCase() + type.slice(1)}' on ${now}.`,
    actionUrl: "/employee/reports",
    actionLabel: "View Reports",
    sessionToken,
    broadcastToEmployee: true,
  });

  return NextResponse.json(report);
} 