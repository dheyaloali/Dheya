import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/auth-guard";
import prisma from "@/lib/prisma";

// Helper function to get or create employee record for unapproved users
async function getOrCreateEmployeeRecord(userId: string, userData: any) {
  let employee = await prisma.employee.findFirst({ 
    where: { userId }, 
    include: { user: true } 
  });
  
  // If no employee record exists, create a temporary one for unapproved users
  if (!employee && userData.role === 'employee' && !userData.isApproved) {
    employee = await prisma.employee.create({
      data: {
        userId: userId,
        position: 'Pending Approval',
        city: 'Pending',
        joinDate: new Date(),
        user: {
          connect: { id: userId }
        }
      },
      include: { user: true }
    });
  }
  
  return employee;
}

// GET: Fetch employee profile (with user info)
export async function GET(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  
  const userId = session.user.id;
  const employee = await getOrCreateEmployeeRecord(userId, session.user);
  
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  return NextResponse.json({ employee });
}

// PATCH: Update employee profile
export async function PATCH(req: NextRequest) {
  const auth = await requireAuth(req);
  if (!auth.ok) return NextResponse.json({ error: auth.message }, { status: auth.status });
  const session = auth.session!;
  if (!session.user || !('id' in session.user) || !session.user.id) {
    return NextResponse.json({ error: "User not authenticated" }, { status: 401 });
  }
  
  const userId = session.user.id;
  const employee = await getOrCreateEmployeeRecord(userId, session.user);
  
  if (!employee) {
    return NextResponse.json({ error: "Employee not found" }, { status: 404 });
  }

  const { phoneNumber } = await req.json();
  if (typeof phoneNumber !== 'string' || !/^\+62\d{9,13}$/.test(phoneNumber)) {
    return NextResponse.json({ error: "Phone number must be in Indonesian format: +62xxxxxxxxxxx" }, {
 status: 400 });
  }

  await prisma.user.update({
    where: { id: userId },
    data: { phoneNumber },
  });

  return NextResponse.json({ success: true });
} 