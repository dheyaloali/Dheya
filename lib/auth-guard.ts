import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { headers } from "next/headers";
import jwt from "jsonwebtoken";

// Define session type with admin flag
interface SessionWithAdmin {
  user: {
    id: string;
    name?: string | null;
    email?: string | null;
    image?: string | null;
    isAdmin: boolean;
    role: string;
    isApproved: boolean;
  };
}

// Platform detection constants
const NATIVE_APP_HEADER = 'x-capacitor-platform';
const NATIVE_APP_USER_AGENT_PATTERNS = ['capacitor', 'cordova', 'android', 'ios'];

/**
 * Extracts and validates JWT token from Authorization header
 * Returns the decoded token payload or null if invalid
 */
async function validateJWTFromHeader(request: Request): Promise<any | null> {
  try {
    const authHeader = request.headers.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Decode the JWT token (without verification for now, since we're using the same secret)
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
    return decoded;
  } catch (error) {
    console.error('JWT validation error:', error);
    return null;
  }
}

/**
 * Detects if the request is coming from a native app
 * Uses multiple detection methods for reliability
 */
function isNativeAppRequest(request: Request): boolean {
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
 * Requires authentication and optionally admin role
 * For employees, also enforces native app usage
 * For native requests, validates JWT from Authorization header
 * For web requests, uses session cookies
 */
export async function requireAuth(request: Request, requireAdmin = false) {
  const isNative = isNativeAppRequest(request);
  
  let session: SessionWithAdmin | null = null;
  
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
          isApproved: jwtPayload.isApproved as boolean,
        }
      };
    }
  } else {
    // For web requests, use session cookies
    session = (await getServerSession(authOptions)) as SessionWithAdmin | null;
  }

  if (!session || !session.user) {
    return { ok: false, status: 401, message: "Unauthorized" };
  }

  // For admin access, just check admin role
  if (requireAdmin && !session.user.isAdmin) {
    return { ok: false, status: 403, message: "Forbidden" };
  }

  // For employee access, check platform restrictions
  // Only enforce mobile-only restriction for APPROVED employees
  if (!session.user.isAdmin && !isNative && session.user.isApproved) {
    return { 
      ok: false, 
      status: 403, 
      message: "Employees must use the mobile app" 
    };
  }

  return { ok: true, session };
}

/**
 * Middleware helper to check if a request is from a native app
 * Can be used in middleware.ts to enforce platform restrictions
 */
export function checkNativeAppRequest() {
  const headersList = headers();
  
  // Check for Capacitor platform header
  const capacitorPlatform = headersList.get(NATIVE_APP_HEADER);
  if (capacitorPlatform) {
    return true;
  }
  
  // Check user agent for native app patterns
  const userAgent = headersList.get('user-agent')?.toLowerCase() || '';
  if (NATIVE_APP_USER_AGENT_PATTERNS.some(pattern => userAgent.includes(pattern))) {
    return true;
  }
  
  // Check for custom headers that might be set by our native app
  const isNativeApp = headersList.get('x-app-type') === 'native';
  if (isNativeApp) {
    return true;
  }
  
  return false;
} 