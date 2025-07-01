import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { authOptions } from '@/lib/auth';
import { sendPushNotificationToUser } from '@/lib/firebase-admin';

export async function POST(req: NextRequest) {
  try {
    // Verify authentication - only admins can use this endpoint
    const session = await getServerSession(authOptions);
    if (!session?.user?.id || session?.user?.role !== 'admin') {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }
    
    // Parse request body
    const body = await req.json();
    const { userId, title, message, data } = body;
    
    if (!userId) {
      return NextResponse.json({ error: "Missing required field: userId" }, { status: 400 });
    }
    
    // Send push notification
    const result = await sendPushNotificationToUser(
      userId,
      title || 'Test Notification',
      message || 'This is a test push notification',
      data || { testId: Date.now().toString() }
    );
    
    return NextResponse.json({
      success: true,
      result
    });
    
  } catch (error) {
    console.error("[Test Push API] Error:", error);
    return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
  }
} 