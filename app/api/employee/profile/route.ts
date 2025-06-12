import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

// GET: Fetch employee profile (with user info)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const userId = (auth.session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: "User ID missing" }, { status: 400 });

  const employee = await prisma.employee.findFirst({
    where: { userId },
    include: {
      user: true, // includes name, email, phone, etc.
    },
  });

  if (!employee) return NextResponse.json({ error: "Employee not found" }, { status: 404 });

  return NextResponse.json({ employee });
}

// PUT: Update employee phone number
export async function PUT(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const userId = (auth.session?.user as any)?.id;
  if (!userId) return NextResponse.json({ error: "User ID missing" }, { status: 400 });

  const { phoneNumber } = await req.json();
  if (typeof phoneNumber !== 'string' || !/^\+62\d{9,13}$/.test(phoneNumber)) {
    return NextResponse.json({ error: "Phone number must be in Indonesian format: +62xxxxxxxxxxx" }, { status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { phoneNumber },
  });

  return NextResponse.json({ success: true });
} 