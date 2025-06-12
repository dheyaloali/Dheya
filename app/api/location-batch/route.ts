import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { requireAuth } from '@/lib/auth-guard';

export async function POST(request: Request) {
  const authResult = await requireAuth(request);
  
  if (!authResult.ok) {
    return NextResponse.json({ error: authResult.message }, { status: authResult.status });
  }
  
  const session = authResult.session;
  
  const batchData = await request.json();
  if (!Array.isArray(batchData) || batchData.length === 0) {
    return NextResponse.json({ error: 'Invalid batch data format' }, { status: 400 });
  }
  
  const employee = await prisma.employee.findFirst({
    where: {
      userId: session.user.id,
    },
  });
  
  if (!employee) {
    return NextResponse.json({ error: 'Employee not found' }, { status: 404 });
  }
  
  // Create batch of location entries
  const locationEntries = await Promise.all(
    batchData.map(async (data) => {
      const { latitude, longitude, accuracy, timestamp, batteryLevel, isMoving } = data;
      
      return prisma.employeeLocation.create({
        data: {
          employeeId: employee.id,
          latitude,
          longitude,
          accuracy: accuracy || 0,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          batteryLevel: batteryLevel || null,
          isMoving: isMoving || true,
        },
      });
    })
  );
  
  return NextResponse.json({ 
    success: true, 
    count: locationEntries.length,
    message: `${locationEntries.length} location entries saved successfully` 
  });
}