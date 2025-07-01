import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import bcrypt from "bcryptjs";
import { checkRateLimit } from '@/lib/rateLimiter';
import { getServerSession } from 'next-auth/next';
import jwt from "jsonwebtoken";

// Platform detection constants
const NATIVE_APP_HEADER = 'x-capacitor-platform';
const NATIVE_APP_USER_AGENT_PATTERNS = ['capacitor', 'cordova', 'android', 'ios'];

/**
 * Detects if the request is coming from a native app
 */
function isNativeAppRequest(request: NextRequest): boolean {
  // Check for Capacitor platform header
  const capacitorPlatform = request.headers.get(NATIVE_APP_HEADER);
  if (capacitorPlatform) {
    return true;
  }

  // Check user agent for native app patterns
  const userAgent = request.headers.get('user-agent')?.toLowerCase() || '';
  if (NATIVE_APP_USER_AGENT_PATTERNS.some(pattern => userAgent.includes(pattern))) {
    return true;
  }

  // Check for custom headers that might be set by our native app
  const isNativeApp = request.headers.get('x-app-type') === 'native';
  if (isNativeApp) {
    return true;
  }

  return false;
}

/**
 * Extracts and validates JWT token from Authorization header
 */
async function validateJWTFromHeader(request: NextRequest): Promise<any | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      console.log('[validate] No Authorization header or not Bearer token');
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    console.log('[validate] JWT token received:', token.substring(0, 20) + '...');
    
    // Decode the JWT token
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
    console.log('[validate] JWT verification successful:', decoded);
    return decoded;
  } catch (error) {
    console.error('JWT validation error in validate endpoint:', error);
    return null;
  }
}

export async function POST(req: NextRequest) {
  // Rate limiting: 5 reset attempts per minute per IP
  const ip = req.headers.get("x-forwarded-for") || req.headers.get("x-real-ip") || "unknown";
  if (!checkRateLimit(ip, { windowMs: 60_000, max: 5 })) {
    return NextResponse.json({ valid: false, error: "Too many reset attempts. Please try again later." }, { status: 429 });
  }

  const { email, password } = await req.json();
  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) return NextResponse.json({ valid: false });

  const isMatch = await bcrypt.compare(password, user.password);
  return NextResponse.json({ valid: isMatch });
}

/**
 * API endpoint to validate if the user's session is still valid
 * This checks if the user still exists in the database
 */
export async function GET(request: NextRequest) {
  try {
    // Check if this is part of a redirect loop
    const url = new URL(request.url);
    const noLoop = url.searchParams.get('noLoop') === 'true';
    
    const isNative = isNativeAppRequest(request);
    let session: any = null;
    
    if (isNative) {
      // For native requests, try to validate JWT from Authorization header
      const jwtPayload = await validateJWTFromHeader(request);
      if (jwtPayload) {
        // Create a session-like object from JWT payload
        session = {
          user: {
            id: jwtPayload.userId || jwtPayload.id as string,
            name: jwtPayload.name as string,
            email: jwtPayload.email as string,
            isAdmin: jwtPayload.isAdmin as boolean,
            role: jwtPayload.role as string,
            sessionVersion: jwtPayload.sessionVersion as number,
            mfaEnabled: jwtPayload.mfaEnabled as boolean,
          }
        };
      }
    } else {
      // For web requests, use session cookies
      session = await getServerSession();
    }
    
    // If no session, return 200 with no_session status instead of 401
    // This indicates absence of session rather than an invalid session
    if (!session?.user?.id) {
      return NextResponse.json({ 
        status: 'no_session',
        message: 'No session found'
      }, { status: 200 });
    }
    
    // Check if user still exists in the database
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, email: true, role: true, sessionVersion: true, mfaEnabled: true }
    });
    
    // If user doesn't exist, return unauthorized (this is an actual invalid session)
    if (!user) {
      console.log(`[Auth Validate] User ${session.user.id} no longer exists in database`);
      return NextResponse.json({ 
        error: 'Unauthorized', 
        code: 'SESSION_INVALID',
        message: 'User account no longer exists'
      }, { status: 401 });
    }
    
    // Check if this is an admin who needs MFA setup
    // If so, allow access only to the MFA setup page
    if (user.role === 'admin' && user.mfaEnabled === false) {
      const path = url.pathname;
      const referer = request.headers.get('referer') || '';
      
      // Allow access to setup-mfa page and its API endpoints
      if (path.includes('/setup-mfa') || 
          path.includes('/api/auth/mfa/') || 
          referer.includes('/setup-mfa')) {
        return NextResponse.json({ 
          valid: true,
          user: {
            id: user.id,
            role: user.role,
            sessionVersion: user.sessionVersion,
            requiresMfaSetup: true
          }
        });
      }
    }
    
    // Check session version only if not in a loop
    if (!noLoop && session.user.sessionVersion !== undefined && 
        user.sessionVersion > session.user.sessionVersion) {
      return NextResponse.json({ 
        error: 'Unauthorized', 
        code: 'SESSION_VERSION_MISMATCH',
        message: 'Session has been invalidated'
      }, { status: 401 });
    }
    
    // Return success with minimal user info
    return NextResponse.json({ 
      valid: true,
      user: {
        id: user.id,
        role: user.role,
        sessionVersion: user.sessionVersion
      }
    });
  } catch (error) {
    console.error('[Auth Validate] Error validating session:', error);
    return NextResponse.json({ 
      error: 'Internal Server Error',
      message: 'An error occurred while validating your session'
    }, { status: 500 });
  }
}