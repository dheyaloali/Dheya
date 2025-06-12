import { Session } from "next-auth"

const CACHE_DURATION = 5 * 60 * 1000 // 5 minutes
let sessionCache: {
  session: Session | null
  timestamp: number
} | null = null

export function getCachedSession(): Session | null {
  if (!sessionCache) return null
  if (Date.now() - sessionCache.timestamp > CACHE_DURATION) {
    sessionCache = null
    return null
  }
  return sessionCache.session
}

export function setCachedSession(session: Session | null) {
  sessionCache = {
    session,
    timestamp: Date.now()
  }
} 