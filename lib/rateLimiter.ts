// lib/rateLimiter.ts
// Simple in-memory rate limiter for Next.js API routes (development only)
// For production, use a distributed store (e.g., Redis) for rate limiting.

import { RateLimiterMemory } from 'rate-limiter-flexible';

// Global limiter: 20 actions per user per 10 minutes
const globalRateLimiter = new RateLimiterMemory({
  points: 20, // 20 actions
  duration: 600, // per 600 seconds (10 minutes)
});

export async function consumeRateLimit(userId: string) {
  // --- TEMPORARY: Disable rate limiting for testing ---
  return null;
  // try {
  //   await globalRateLimiter.consume(userId);
  //   return null; // No error
  // } catch (rejRes) {
  //   return 'Too many actions. Please wait a few minutes and try again.';
  // }
}

const rateLimitMap = new Map<string, { count: number; lastRequest: number }>()

interface RateLimitOptions {
  windowMs: number // Time window in ms
  max: number      // Max requests per window
}

/**
 * Get the maximum login attempts from localStorage or use the default
 */
export function getMaxLoginAttempts(): number {
  if (typeof window === 'undefined') return 5;
  
  const savedAttempts = localStorage.getItem('max_login_attempts');
  if (!savedAttempts) return 5;
  
  if (savedAttempts === 'unlimited') return 1000; // Effectively unlimited
  
  const attempts = parseInt(savedAttempts, 10);
  return isNaN(attempts) ? 5 : attempts;
}

/**
 * Checks if the given key (e.g., IP) is rate limited.
 * Returns true if allowed, false if rate limited.
 */
export function checkRateLimit(key: string, options: RateLimitOptions): boolean {
  const now = Date.now()
  const entry = rateLimitMap.get(key)
  
  // For login attempts, use the value from localStorage if this is a login attempt
  // We assume login attempts have a 60_000 ms window
  if (options.windowMs === 60_000 && options.max === 5) {
    // This is likely a login attempt check, so use the configured max attempts
    options.max = getMaxLoginAttempts();
  }
  
  if (!entry || now - entry.lastRequest > options.windowMs) {
    // New window
    rateLimitMap.set(key, { count: 1, lastRequest: now })
    return true
  }
  if (entry.count < options.max) {
    entry.count++
    entry.lastRequest = now
    return true
  }
  return false // Rate limited
} 