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
  
  try {
    // Use createMany for better performance with batch operations
    // This will ensure the composite index (employeeId, timestamp) is properly utilized
    const createdLocations = await prisma.employeeLocation.createMany({
      data: batchData.map(data => {
        const { latitude, longitude, accuracy, timestamp, batteryLevel, isMoving } = data;
        
        return {
          employeeId: employee.id,
          latitude,
          longitude,
          accuracy: accuracy || 0,
          timestamp: timestamp ? new Date(timestamp) : new Date(),
          batteryLevel: batteryLevel || null,
          isMoving: isMoving || true,
        };
      }),
      skipDuplicates: true, // Skip any potential duplicates based on unique constraints
    });
    
    return NextResponse.json({ 
      success: true, 
      count: createdLocations.count,
      message: `${createdLocations.count} location entries saved successfully` 
    });
  } catch (error) {
    console.error('Error saving batch location data:', error);
    return NextResponse.json({ 
      success: false, 
      error: 'Failed to save location data' 
    }, { status: 500 });
  }
}