import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/app/api/auth/[...nextauth]/route';
import { prisma } from '@/lib/prisma';

export async function PUT(req: NextRequest, { params }: { params: { id: string } }) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const notificationId = parseInt(params.id, 10);
  const userId = session.user.id;
  const user = await prisma.user.findUnique({
    where: { id: userId },
    include: { employee: true }
  });

  const notification = await prisma.notification.findUnique({ where: { id: notificationId } });
  if (!notification) {
    return NextResponse.json({ error: 'Notification not found' }, { status: 404 });
  }

  const isOwner =
    (user?.role === 'admin' && notification.userId === userId) ||
    (user?.employee && notification.employeeId === user.employee.id);

  if (!isOwner) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  await prisma.notification.update({
    where: { id: notificationId },
    data: { read: true }
  });

  return NextResponse.json({ success: true });
} 