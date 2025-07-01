import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

// CSRF token configuration
const CSRF_TOKEN_LENGTH = 32
const CSRF_TOKEN_EXPIRY = 24 * 60 * 60 * 1000 // 24 hours

// Generate a secure random string using Web Crypto API (Edge compatible)
export async function generateCsrfToken(): Promise<string> {
  // Use a technique that works in both browser and Edge environments
  const array = new Uint8Array(CSRF_TOKEN_LENGTH);
  
  if (typeof crypto !== 'undefined') {
    // This works in modern browsers and Edge Runtime
    crypto.getRandomValues(array);
  } else {
    // Fallback for environments without crypto
    for (let i = 0; i < array.length; i++) {
      array[i] = Math.floor(Math.random() * 256);
    }
  }
  
  // Convert to hex string
  return Array.from(array)
    .map(b => b.toString(16).padStart(2, '0'))
    .join('');
}

// Validate CSRF token
export async function validateCsrfToken(req: NextRequest): Promise<boolean> {
  try {
    const token = await getToken({ req })
    if (!token) {
      return false
    }

    const csrfToken = req.headers.get('x-csrf-token')
    if (!csrfToken || csrfToken !== token.csrfToken) {
      return false
    }

    return true
  } catch (error) {
    console.error('CSRF validation error:', error)
    return false
  }
}

// CSRF middleware for API routes
export async function csrfMiddleware(req: NextRequest) {
  // Skip CSRF check for GET requests
  if (req.method === 'GET') {
    return NextResponse.next()
  }

  // Skip CSRF check for public routes
  const publicRoutes = ['/api/auth/login', '/api/auth/register', '/api/auth/request-password-reset']
  if (publicRoutes.some(route => req.nextUrl.pathname.startsWith(route))) {
    return NextResponse.next()
  }

  const isValid = await validateCsrfToken(req)
  if (!isValid) {
    return NextResponse.json(
      { error: 'Invalid CSRF token' },
      { 
        status: 403,
        headers: {
          'X-CSRF-Protection': '1',
          'X-Content-Type-Options': 'nosniff'
        }
      }
    )
  }

  // Add security headers to the response
  const response = NextResponse.next()
  response.headers.set('X-CSRF-Protection', '1')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-XSS-Protection', '1; mode=block')
  
  return response
} 