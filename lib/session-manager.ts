import { signOut } from "next-auth/react";
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

// Default session timeout: 30 minutes (in milliseconds)
export const SESSION_TIMEOUT = 30 * 60 * 1000;

// Store user session data in localStorage
interface UserSession {
  id: string;
  lastActive: number;
}

// Check if user is authenticated
export function isAuthenticated(): boolean {
  if (typeof window === 'undefined') return false;
  
  const session = localStorage.getItem('user_session');
  if (!session) return false;
  
  try {
    const userSession: UserSession = JSON.parse(session);
    const now = Date.now();
    const elapsed = now - userSession.lastActive;
    
    // Get the current session timeout (from settings or default)
    const currentTimeout = getSessionTimeout();
    
    // Session expired
    if (elapsed > currentTimeout) {
      localStorage.removeItem('user_session');
      return false;
    }
    
    return true;
  } catch (error) {
    return false;
  }
}

// Get current user session
export function getCurrentUser(): UserSession | null {
  if (typeof window === 'undefined') return null;
  
  const session = localStorage.getItem('user_session');
  if (!session) return null;
  
  try {
    return JSON.parse(session);
  } catch (error) {
    return null;
  }
}

// Update last active timestamp
export function updateLastActive(): void {
  if (typeof window === 'undefined') return;
  
  const session = localStorage.getItem('user_session');
  if (!session) return;
  
  try {
    const userSession: UserSession = JSON.parse(session);
    userSession.lastActive = Date.now();
    localStorage.setItem('user_session', JSON.stringify(userSession));
  } catch (error) {
    // Ignore errors
  }
}

// Initialize user session
export function initSession(userId: string): void {
  if (typeof window === 'undefined') return;
  
  const userSession: UserSession = {
    id: userId,
    lastActive: Date.now()
  };
  
  localStorage.setItem('user_session', JSON.stringify(userSession));
}

// Logout user
export async function logout(): Promise<void> {
  if (typeof window === 'undefined') return;
  
  // Clear local session data
  localStorage.removeItem('user_session');
  
  // --- Native: Clear JWT from Preferences ---
  if (Capacitor.isNativePlatform()) {
    try {
      await Preferences.remove({ key: 'jwt' });
      console.log('[Native] Cleared JWT from Preferences on logout');
    } catch (error) {
      console.warn('[Native] Error clearing JWT from Preferences:', error);
    }
  }
  
  // Sign out from NextAuth
  signOut({ callbackUrl: '/login' });
}

// Set session timeout (in minutes)
export function setSessionTimeout(minutes: number): void {
  // Store in localStorage for persistence
  if (typeof window === 'undefined') return;
  localStorage.setItem('session_timeout', String(minutes * 60 * 1000));
}

// Get current session timeout
export function getSessionTimeout(): number {
  if (typeof window === 'undefined') return SESSION_TIMEOUT;
  
  const timeout = localStorage.getItem('session_timeout');
  if (!timeout) return SESSION_TIMEOUT;
  
  const timeoutMs = parseInt(timeout, 10);
  return isNaN(timeoutMs) ? SESSION_TIMEOUT : timeoutMs;
}

// Convert session timeout string from settings to milliseconds
export function convertTimeoutToMs(timeout: string): number {
  if (!timeout) return SESSION_TIMEOUT;
  
  // Parse formats like "15m", "30m", "1h", "2h", "4h", "8h"
  const match = timeout.match(/^(\d+)([mh])$/);
  if (!match) return SESSION_TIMEOUT;
  
  const [_, value, unit] = match;
  const numValue = parseInt(value, 10);
  
  if (isNaN(numValue)) return SESSION_TIMEOUT;
  
  // Convert to milliseconds
  if (unit === 'm') {
    return numValue * 60 * 1000; // minutes to ms
  } else if (unit === 'h') {
    return numValue * 60 * 60 * 1000; // hours to ms
  }
  
  return SESSION_TIMEOUT;
} 