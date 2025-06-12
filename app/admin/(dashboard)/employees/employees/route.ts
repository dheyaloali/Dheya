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
  const page = parseInt(searchParams.get("page") || "1", 10);
  const pageSize = parseInt(searchParams.get("pageSize") || "10", 10);
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      include: {
        user: true,
        employeeProducts: { include: { product: true } },
      },
      orderBy: { id: "asc" },
      skip,
      take,
    }),
    prisma.employee.count(),
  ]);
  return NextResponse.json({ employees, total });
}

export async function POST(req: NextRequest) {
  const auth = await requireAuth(req, true); // Only admin can create employees
  if (!auth.ok) {
    return NextResponse.json({ error: auth.message }, { status: auth.status });
  }
  try {
    const data = await req.json();

    // Check if email already exists
    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existingUser) {
      return NextResponse.json({ error: "Email already exists" }, { status: 400 });
    }

    // Create user
    const user = await prisma.user.create({
      data: {
        name: data.name,
        email: data.email,
        password: Math.random().toString(36).slice(-8),
        role: "employee",
        status: (data.status && data.status.toLowerCase() === "inactive") ? "inactive" : "active",
      },
    });

    // Create employee (no status field)
    const employee = await prisma.employee.create({
      data: {
        userId: user.id,
        city: data.city,
        position: data.position,
        joinDate: data.startDate ? new Date(data.startDate) : new Date(),
      },
    });

    return NextResponse.json({ employee });
  } catch (error) {
    console.error(error);
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
} 