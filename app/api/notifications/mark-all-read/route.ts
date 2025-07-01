import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true }
  });

  let where: any = { read: false };
  if (user?.role === 'admin') {
    where.userId = userId;
  } else if (user?.employee) {
    where.employeeId = user.employee.id;
  } else {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  await prisma.notification.updateMany({
    where,
    data: { read: true }
  });

  return NextResponse.json({ success: true });
} 