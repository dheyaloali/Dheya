"use client";

import { useEffect, useState, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useToast } from '@/components/ui/use-toast';
import { logout } from '@/lib/session-manager';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

/**
 * SessionValidator component
 * 
 * This component monitors API responses for session validation errors
 * and redirects to the login page if the session is invalid.
 * 
 * It should be included in the layout or main component tree.
 */
export default function SessionValidator() {
  const [lastValidationTime, setLastValidationTime] = useState(Date.now());
  const { data: session, status, update } = useSession();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  // Check if we're on an auth page or have special parameters
  const isAuthPage = 
    pathname === '/login' || 
    pathname === '/register' || 
    pathname === '/forgot-password' ||
    pathname === '/reset-password' ||
    pathname.startsWith('/reset-password/') ||
    pathname === '/waiting-approval' ||
    pathname.startsWith('/verify-email/');
    
  const hasSpecialParams = 
    searchParams.get('error') === 'session_expired' ||
    searchParams.get('noLoop') === 'true' ||
    searchParams.get('cleared') === 'true';
  
  // Immediately validate session on component mount and when session changes
  useEffect(() => {
    // Skip validation on auth pages, with special params, or if not authenticated
    if (isAuthPage || hasSpecialParams || status !== 'authenticated' || !session?.user?.id) {
      return;
    }
    
    const validateSession = async () => {
      try {
        // Prepare headers for the request
        const headers: Record<string, string> = {
          'Content-Type': 'application/json',
        };
        
        // --- Native: Add JWT Authorization Header ---
        if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
          try {
            const { value: jwt } = await Preferences.get({ key: 'jwt' });
            if (jwt) {
              headers['Authorization'] = `Bearer ${jwt}`;
              console.log('[SessionValidator] Added JWT Authorization header for validation');
              console.log('[SessionValidator] JWT first 20 chars:', jwt.substring(0, 20) + '...');
            } else {
              console.warn('[SessionValidator] No JWT found in Preferences');
            }
          } catch (error) {
            console.warn('[SessionValidator] Error getting JWT from Preferences:', error);
          }
        }
        
        // Try to fetch user profile - this will fail if user doesn't exist
        const response = await fetch('/api/auth/validate', {
          method: 'GET',
          headers,
        });
        
        if (!response.ok) {
          const data = await response.json();
          
          // Force logout if user doesn't exist
          if (response.status === 401 && data.code === 'SESSION_INVALID') {
            // Clear local session data
            localStorage.removeItem('user_session');
            
            // Show toast notification
            toast({
              title: "Session Expired",
              description: data.message || "Your session has expired or is invalid. Please log in again.",
              variant: "destructive",
            });
            
            // Force sign out using our logout function (handles native JWT cleanup)
            await logout();
            
            // Redirect to login page with noLoop parameter
            router.push('/login?error=session_expired&noLoop=true');
          }
        }
      } catch (error) {
        console.error("Error validating session:", error);
      }
    };
    
    // Validate immediately
    validateSession();
    
    // Set up interval to check periodically (every 30 seconds)
    const intervalId = setInterval(validateSession, 30000);
    
    return () => clearInterval(intervalId);
  }, [session, status, router, toast, isAuthPage, hasSpecialParams]);
  
  // Override fetch to catch session validation errors
  useEffect(() => {
    // Skip on auth pages or with special params
    if (isAuthPage || hasSpecialParams || status !== 'authenticated') {
      return;
    }
    
    // Store the original fetch function
    const originalFetch = window.fetch;
    
    // Override fetch to intercept responses
    window.fetch = async (input, init) => {
      // Call the original fetch
      const response = await originalFetch(input, init);
      
      // Clone the response so we can read the body
      const clone = response.clone();
      
      // Only check JSON responses
      const contentType = response.headers.get('content-type');
      if (contentType && contentType.includes('application/json')) {
        try {
          const data = await clone.json();
          
          // Check for session validation errors
          if (response.status === 401 && data.code === 'SESSION_INVALID') {
            // Prevent multiple redirects
            if (Date.now() - lastValidationTime > 5000) {
              setLastValidationTime(Date.now());
              
              // Show toast notification
              toast({
                title: "Session Expired",
                description: data.message || "Your session has expired or is invalid. Please log in again.",
                variant: "destructive",
              });
              
              // Clear local session data
              localStorage.removeItem('user_session');
              
              // Sign out using our logout function (handles native JWT cleanup)
              await logout();
              
              // Redirect to login with noLoop parameter
              router.push('/login?error=session_expired&noLoop=true');
            }
          }
        } catch (error) {
          // Ignore JSON parsing errors
        }
      }
      
      // Return the original response
      return response;
    };
    
    // Restore the original fetch on cleanup
    return () => {
      window.fetch = originalFetch;
    };
  }, [router, toast, lastValidationTime, status, isAuthPage, hasSpecialParams]);
  
  // No UI needed
  return null;
}

export function SessionValidatorWithSuspense() {
  return (
    <Suspense fallback={null}>
      <SessionValidator />
    </Suspense>
  );
} 