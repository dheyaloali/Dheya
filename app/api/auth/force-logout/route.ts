import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

/**
 * API endpoint to force logout by clearing all auth cookies
 * and invalidating the session in the database
 */
export async function GET(request: Request) {
  try {
    // Check if this is a client-side initiated request or a redirect loop
    const url = new URL(request.url);
    const noRedirect = url.searchParams.get('noRedirect') === 'true';
    const hasError = url.searchParams.get('error') !== null;
    
    // Get the session to find the session ID
    const session = await getServerSession();
    
    // Set cookie options to expire cookies
    const cookieOptions = {
      maxAge: 0,
      path: '/',
      expires: new Date(0),
      secure: process.env.NODE_ENV === 'production',
      httpOnly: true,
      sameSite: 'lax' as const
    };
    
    // If we have a session, invalidate it in the database
    let hadSession = false;
    if (session?.user?.id) {
      hadSession = true;
      try {
        // Update the user's sessionVersion to invalidate all current sessions
        await prisma.user.update({
          where: { id: session.user.id },
          data: { 
            sessionVersion: { increment: 1 }
          }
        });
        console.log(`[Force Logout] Invalidated session for user ${session.user.id}`);
      } catch (dbError) {
        console.error('[Force Logout] Error updating session version:', dbError);
      }
    } else {
      console.log('[Force Logout] No active session to invalidate');
    }
    
    // If this is a client-side initiated request and not already an error redirect
    // and we had an actual session to invalidate
    if (!noRedirect && !hasError && hadSession) {
      const response = NextResponse.redirect(new URL('/login?error=session_expired&noLoop=true', 
        process.env.NEXTAUTH_URL || 'http://localhost:3000'));
      
      // Clear all NextAuth related cookies
      response.cookies.set('next-auth.session-token', '', cookieOptions);
      response.cookies.set('next-auth.csrf-token', '', cookieOptions);
      response.cookies.set('next-auth.callback-url', '', cookieOptions);
      
      // Clear chunked cookies if present
      for (let i = 0; i < 10; i++) {
        response.cookies.set(`next-auth.session-token.${i}`, '', cookieOptions);
      }
      
      return response;
    } else {
      // Just return a JSON response without redirecting
      const response = NextResponse.json({ 
        success: true, 
        message: hadSession ? 'Logged out successfully' : 'No active session',
        hadSession,
        redirected: false
      });
      
      // Still clear cookies
      response.cookies.set('next-auth.session-token', '', cookieOptions);
      response.cookies.set('next-auth.csrf-token', '', cookieOptions);
      response.cookies.set('next-auth.callback-url', '', cookieOptions);
      
      // Clear chunked cookies if present
      for (let i = 0; i < 10; i++) {
        response.cookies.set(`next-auth.session-token.${i}`, '', cookieOptions);
      }
      
      return response;
    }
  } catch (error) {
    console.error('[Force Logout] Error clearing cookies:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: 'An error occurred while logging you out'
    }, { status: 500 });
  }
} 