import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { requireAuth } from "@/lib/auth-guard";

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

  // Filtering params
  const search = searchParams.get("search") || "";
  const city = searchParams.get("city") || "";
  const position = searchParams.get("position") || "";
  const status = searchParams.get("status") || "";
  const joinDate = searchParams.get("joinDate") || "";

  // Build where clause
  let where: any = {};

  // Search (name, email, city, position)
  if (search) {
    where.OR = [
      { user: { name: { contains: search } } },
      { user: { email: { contains: search } } },
      { city: { contains: search } },
      { position: { contains: search } },
    ];
  }
  // City, Position, JoinDate
  if (city && city !== "All") where.city = city;
  if (position && position !== "All") where.position = position;
  if (joinDate) where.joinDate = joinDate;

  // Status (must be merged into user filter)
  if (status && status !== "All") {
    if (where.OR) {
      where.AND = where.AND || [];
      where.AND.push({ user: { status: { equals: status } } });
    } else {
      where.user = { status: { equals: status } };
    }
  }

  const [employees, total] = await Promise.all([
    prisma.employee.findMany({
      where,
      include: {
        user: true,
        employeeProducts: { include: { product: true } },
      },
      orderBy: { id: "asc" },
      skip,
      take,
    }),
    prisma.employee.count({ where }),
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

    // Combined uniqueness check for email and name (case-insensitive)
    const existingUser = await prisma.user.findFirst({
      where: {
        OR: [
          { email: { equals: data.email, mode: 'insensitive' } },
          { name: { equals: data.name, mode: 'insensitive' } }
        ]
      }
    });
    if (existingUser) {
      return NextResponse.json({ error: "Email or name already exists" }, { status: 400 });
    }

    // Validate phone number
    if (!data.phoneNumber || typeof data.phoneNumber !== 'string' || !/^\+62\d{9,13}$/.test(data.phoneNumber.trim())) {
      return NextResponse.json({ error: "Phone number must be provided in Indonesian format: +62xxxxxxxxxxx" }, { status: 400 });
    }

    // Use a transaction to create user and employee atomically
    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          name: data.name,
          email: data.email,
          password: Math.random().toString(36).slice(-8),
          role: "employee",
          status: (data.status && data.status.toLowerCase() === "inactive") ? "inactive" : "active",
          phoneNumber: data.phoneNumber.trim(),
        },
      });

      const employee = await tx.employee.create({
        data: {
          userId: user.id,
          city: data.city,
          position: data.position,
          joinDate: data.startDate ? new Date(data.startDate) : new Date(),
        },
      });

      return { user, employee };
    });

    return NextResponse.json({ employee: result.employee });
  } catch (error) {
    return NextResponse.json({ error: "Failed to create employee" }, { status: 500 });
  }
} 