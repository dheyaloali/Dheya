import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

// GET: List all sales targets for a given month and year
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { searchParams } = new URL(req.url);
    const month = parseInt(searchParams.get("month") || String(new Date().getMonth() + 1), 10);
    const year = parseInt(searchParams.get("year") || String(new Date().getFullYear()), 10);
    const targets = await prisma.salesTarget.findMany({
      where: { month, year },
      select: { employeeId: true, targetAmount: true },
    });
    return NextResponse.json({ targets });
  } catch (error) {
    return NextResponse.json({ error: "Failed to fetch sales targets" }, { status: 500 });
  }
}

// POST: Assign or update a sales target for an employee/month/year
export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { employeeId, month, year, targetAmount } = await req.json();
    if (!employeeId || !month || !year || typeof targetAmount !== "number") {
      return NextResponse.json({ error: "Missing or invalid fields" }, { status: 400 });
    }
    if (targetAmount === 0) {
      // Treat as delete
      await prisma.salesTarget.deleteMany({ where: { employeeId, month, year } });
      return NextResponse.json({ success: true, deleted: true });
    }
    // Upsert target
    await prisma.salesTarget.upsert({
      where: { employeeId_year_month: { employeeId, year, month } },
      update: { targetAmount },
      create: { employeeId, year, month, targetAmount },
    });
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: "Failed to assign/update sales target" }, { status: 500 });
  }
}

// DELETE: Remove a sales target for an employee/month/year
export async function DELETE(req: NextRequest) {
  const auth = await requireAuth(req, true);
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const { searchParams } = new URL(req.url);
    const employeeId = parseInt(searchParams.get("employeeId") || "");
    const month = parseInt(searchParams.get("month") || "");
    const year = parseInt(searchParams.get("year") || "");
    if (!employeeId || !month || !year) {
      return NextResponse.json({ error: "Missing parameters" }, { status: 400 });
    }
    const deleted = await prisma.salesTarget.deleteMany({ where: { employeeId, month, year } });
    return NextResponse.json({ success: deleted.count > 0 });
  } catch (error) {
    return NextResponse.json({ error: "Failed to delete sales target" }, { status: 500 });
  }
} 