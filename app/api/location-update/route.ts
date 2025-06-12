import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { LocationUpdatePayload } from '@/lib/location-types';
import { requireAuth } from '@/lib/auth-guard';
import { reverseGeocode } from '@/lib/server-geocode';

export async function POST(request: Request) {
  const authResult = await requireAuth(request);
  
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.message }, { status: authResult.status });
  }
  
  const session = authResult.session;
  
  const { latitude, longitude, accuracy, batteryLevel, isMoving } = await request.json() as LocationUpdatePayload;
  
  const employee = await prisma.employee.findFirst({
    where: {
      userId: session.user.id,
    },
  });
  
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  
  // Server-side reverse geocoding with caching
  let address: string | null = null;
  const existing = await prisma.employeeLocation.findFirst({
    where: { latitude, longitude, address: { not: null } },
    select: { address: true }
  });
  if (existing?.address) {
    address = existing.address;
  } else {
    address = await reverseGeocode(latitude, longitude);
  }
  
  const location = await prisma.employeeLocation.create({
    data: {
      employeeId: employee.id,
      latitude,
      longitude,
      accuracy: accuracy || 0,
      batteryLevel: batteryLevel || null,
      isMoving: isMoving || true,
      address,
    },
  });
  
  // Broadcast to WebSocket server (fire and forget)
  fetch('http://localhost:3001/broadcast-location', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      employeeId: employee.id,
      latitude,
      longitude,
      accuracy: accuracy || 0,
      batteryLevel: batteryLevel || null,
      isMoving: isMoving || true,
      address,
      timestamp: location.createdAt,
    }),
  }).catch(() => {});

  return NextResponse.json(location);
}