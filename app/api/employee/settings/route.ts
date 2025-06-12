import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

// GET: Fetch employee settings
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const userId = (auth.session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: "User ID missing" }, { status: 400 });

  const employee = await prisma.employee.findFirst({ where: { userId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  let settings = await prisma.employeeSettings.findUnique({ where: { employeeId: employee.id } });
  if (!settings) {
    // Create default settings if not exist
    settings = await prisma.employeeSettings.create({
      data: { 
        employeeId: employee.id, 
        language: "en", 
        locationAccess: false, 
        notifications: true 
      }
    });
  }

  return NextResponse.json({
    locationAccess: settings.locationAccess,
    notifications: settings.notifications,
    language: settings.language,
    employeeRealtimeEnabled: true // Always enable real-time for employees
  });
}

// PUT: Update employee settings
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const userId = (auth.session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: "User ID missing" }, { status: 400 });

  const employee = await prisma.employee.findFirst({ where: { userId } });
  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  const body = await req.json();
  const updateData: any = {};
  if (body.language && ["en", "id"].includes(body.language)) {
    updateData.language = body.language;
  }
  if (typeof body.locationAccess === "boolean") {
    updateData.locationAccess = body.locationAccess;
  }
  // Do NOT allow notifications to be updated by the user
  if (Object.keys(updateData).length === 0) {
    return NextResponse.json({ error: "No valid fields to update" }, { status: 400 });
  }

  await prisma.employeeSettings.upsert({
    where: { employeeId: employee.id },
    update: updateData,
    create: { employeeId: employee.id, ...updateData, notifications: true },
  });

  return NextResponse.json({ success: true });
} 