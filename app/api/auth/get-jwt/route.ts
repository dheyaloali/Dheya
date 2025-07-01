import { NextRequest, NextResponse } from 'next/server';
import { getToken } from 'next-auth/jwt';
import jwt from 'jsonwebtoken';

export async function GET(request: NextRequest) {
  try {
    console.log('[get-jwt] Getting token...');
    
    // Get the token data (not raw encrypted token)
    const tokenData = await getToken({ 
      req: request,
      secret: process.env.NEXTAUTH_SECRET
    });
    
    if (!tokenData) {
      console.log('[get-jwt] No token data found');
      return NextResponse.json({ error: 'No token found' }, { status: 401 });
    }
    
    // Create a standard JWT from the token data
    const token = jwt.sign(tokenData, process.env.NEXTAUTH_SECRET!);
    
    console.log('[get-jwt] Created JWT token:', token.substring(0, 20) + '...');
    return NextResponse.json({ token });
  } catch (error) {
    console.error('[get-jwt] Error getting JWT:', error);
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
} 