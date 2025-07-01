import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

// Platform detection constants
const NATIVE_APP_HEADER = 'x-capacitor-platform';
const NATIVE_APP_USER_AGENT_PATTERNS = ['capacitor', 'cordova', 'android', 'ios'];

// Define public routes that don't need auth
const publicRoutes = [
  '/login',
  '/register',
  '/forgot-password',
  '/reset-password',
  '/verify-email',
  '/setup-mfa',
  '/waiting-approval',
  '/employee-app-required' // This page should be public
];

/**
 * Detects if the request is coming from a native app
 * Uses multiple detection methods for reliability
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
  if (request.headers.get('x-app-type') === 'native') {
    return true;
  }

  // Check for query parameter that might be set by native app
  const url = new URL(request.url);
  if (url.searchParams.get('platform') === 'native') {
    return true;
  }

  // Check for specific referer patterns
  const referer = request.headers.get('referer') || '';
  if (referer.includes('capacitor://') || referer.includes('http://10.0.2.2:3000')) {
    return true;
  }

  return false;
}

/**
 * Check if the request has JWT in Authorization header
 */
function hasJwtToken(request: NextRequest): boolean {
  const authHeader = request.headers.get('authorization');
  return authHeader !== null && authHeader.startsWith('Bearer ');
}

export async function middleware(request: NextRequest) {
  const pathname = request.nextUrl.pathname;

  // Skip middleware for static assets and API routes
  if (pathname.startsWith('/api') || pathname.startsWith('/_next') || pathname.includes('.')) {
    return NextResponse.next();
  }

  const isNative = isNativeAppRequest(request);

  // Check if session token exists (without manual verification)
  const sessionToken = request.cookies.get("next-auth.session-token")?.value;
  const hasSession = !!sessionToken;
  
  // For native apps, also check for JWT in Authorization header
  const hasToken = hasSession || (isNative && hasJwtToken(request));
  
  if (!hasToken) {
    console.log("MIDDLEWARE: No session token or JWT found.");
  }
  
  // Check if it's a public route
  const isPublicRoute = publicRoutes.some(route => 
    pathname.startsWith(route) || pathname === route
  );

  // If it's a public route, allow access
  if (isPublicRoute) {
    return NextResponse.next();
  }

  // Handle authenticated routes
  if (!hasToken) {
    // If no token and not a public route, redirect to login
    return NextResponse.redirect(new URL('/login', request.url));
  }

  // For routes that need authentication, let the page components handle
  // the actual session validation and role-based redirects
  // This avoids JWT format conflicts in middleware

  const locales = ['en', 'id'];
  const defaultLocale = 'en';

  // Set locale cookie based on Accept-Language header or default to 'en'
  const acceptLanguage = request.headers.get('accept-language') || '';
  let locale = defaultLocale;
  
  for (const supportedLocale of locales) {
    if (acceptLanguage.includes(supportedLocale)) {
      locale = supportedLocale;
      break;
    }
  }

  const response = NextResponse.next();
  response.cookies.set('locale', locale);
  return response;
}

export const config = {
  matcher: ['/((?!api|_next/static|_next/image|favicon.ico|.*\\.).*)'],
}; 