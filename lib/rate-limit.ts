import { NextRequest } from 'next/server'

// Simple in-memory store for rate limiting
const rateLimitStore = new Map<string, { count: number; resetTime: number }>()

export async function rateLimit(
  request: NextRequest,
  limit: number = 100,
  window: number = 15 * 60 // 15 minutes in seconds
): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
  const ip = request.ip ?? 'anonymous'
  const now = Date.now()
  const windowMs = window * 1000

  // Get current rate limit info
  const current = rateLimitStore.get(ip)
  const resetTime = current?.resetTime ?? now + windowMs

  // If the window has expired, reset the counter
  if (current && now > current.resetTime) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs })
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil((now + windowMs) / 1000)
    }
  }

  // If no current entry, create one
  if (!current) {
    rateLimitStore.set(ip, { count: 1, resetTime: now + windowMs })
    return {
      success: true,
      limit,
      remaining: limit - 1,
      reset: Math.ceil((now + windowMs) / 1000)
    }
  }

  // If we've hit the limit, return failure
  if (current.count >= limit) {
    return {
      success: false,
      limit,
      remaining: 0,
      reset: Math.ceil(current.resetTime / 1000)
    }
  }

  // Increment the counter
  current.count++
  rateLimitStore.set(ip, current)

  return {
    success: true,
    limit,
    remaining: limit - current.count,
    reset: Math.ceil(current.resetTime / 1000)
  }
}

// Clean up expired entries periodically
setInterval(() => {
  const now = Date.now()
  for (const [ip, data] of rateLimitStore.entries()) {
    if (now > data.resetTime) {
      rateLimitStore.delete(ip)
    }
  }
}, 60000) // Clean up every minute 