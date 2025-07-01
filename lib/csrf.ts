// Client/browser-safe CSRF utilities
// For server-side CSRF logic, use lib/server/csrf.ts

// Utility to get CSRF token from cookie
export function getCsrfTokenFromCookie(): string {
  if (typeof window === 'undefined') return ''
  
  const match = document.cookie.match(/(?:^|; )next-auth\.csrf-token=([^;]*)/)
  if (!match) return ''
  
  // The cookie value is like: token|hash, we want only the token part
  return decodeURIComponent(match[1]).split('|')[0]
}

// Add CSRF token to fetch requests
export function addCsrfTokenToRequest(options: RequestInit = {}): RequestInit {
  const csrfToken = getCsrfTokenFromCookie()
  
  return {
    ...options,
    headers: {
      ...options.headers,
      'x-csrf-token': csrfToken,
    },
    credentials: 'include', // This enables CSRF protection
  }
} 