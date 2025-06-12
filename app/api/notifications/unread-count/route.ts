import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function GET(req: NextRequest) {
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
    where = {
      AND: [
        { read: false },
        {
          OR: [
            { userId: userId },
            { type: { startsWith: 'admin_' } },
            { type: { startsWith: 'employee_' } }
          ]
        }
      ]
    };
  } else if (user?.employee) {
    where = {
      AND: [
        { read: false },
        {
          OR: [
            { userId: userId },
            { employeeId: user.employee.id }
          ]
        }
      ]
    };
  } else {
    return NextResponse.json({ error: 'User not found' }, { status: 404 });
  }

  const count = await prisma.notification.count({ where });
  return NextResponse.json({ count });
} 