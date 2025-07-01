import { authOptions } from '@/lib/auth';
import { getServerSession } from 'next-auth/next';
import { prisma } from '@/lib/prisma';

// Simple in-memory cache to reduce database load
const userExistsCache = new Map<string, { exists: boolean; timestamp: number }>();
const CACHE_TTL = 60 * 1000; // 1 minute

/**
 * Validates that a session is valid and the user still exists in the database
 * @returns The session if valid, null otherwise
 */
export async function validateSession(req: Request, context?: any) {
  try {
    // Get session using existing NextAuth setup
    const session = await getServerSession(authOptions);
    if (!session?.user?.id) return null;
    
    const userId = session.user.id;
    
    // Check cache first to reduce database load
    const cachedEntry = userExistsCache.get(userId);
    if (cachedEntry && Date.now() - cachedEntry.timestamp < CACHE_TTL) {
      return cachedEntry.exists ? session : null;
    }
    
    // Verify user still exists in database
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: { id: true }
    });
    
    // Update cache
    userExistsCache.set(userId, {
      exists: !!user,
      timestamp: Date.now()
    });
    
    return user ? session : null;
  } catch (error) {
    console.error("[Session Validation] Error validating session:", error);
    // Fail closed on errors for security
    return null;
  }
}

/**
 * Clears the session validation cache
 * Useful for testing or when forcing re-validation
 */
export function clearSessionCache() {
  userExistsCache.clear();
} 