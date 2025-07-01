import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { prisma } from '@/lib/prisma';

export async function POST(req: NextRequest) {
  try {
    // Verify authentication
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) {
      return NextResponse.json({ error: "Unauthorized", code: "SESSION_INVALID" }, { status: 401 });
    }
    
    // Parse request body
    const body = await req.json();
    const { token, platform, tokenType = 'fcm' } = body;
    
    if (!token) {
      return NextResponse.json({ error: "Missing required field: token" }, { status: 400 });
    }
    
    // Get user ID from session
    const userId = session.user.id;
    
    // Check if employee or admin
    const user = await prisma.user.findUnique({
      where: { id: userId },
      include: { employee: true }
    });
    
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }
    
    // Check if token already exists for this user
    const existingToken = await prisma.deviceToken.findFirst({
      where: {
        token,
        userId
      }
    });
    
    if (existingToken) {
      // Update last seen timestamp and token type
      await prisma.deviceToken.update({
        where: { id: existingToken.id },
        data: { 
          lastSeen: new Date(),
          tokenType
        }
      });
      
      return NextResponse.json({ 
        message: "Device token updated", 
        id: existingToken.id 
      });
    }
    
    // Create new device token
    const deviceToken = await prisma.deviceToken.create({
      data: {
        token,
        userId,
        platform: platform || 'unknown',
        tokenType,
        employeeId: user.employee?.id,
        lastSeen: new Date(),
      }
    });
    
    return NextResponse.json({
      message: "Device token registered successfully",
      id: deviceToken.id
    });
    
  } catch (error) {
    console.error("[Register Device API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 