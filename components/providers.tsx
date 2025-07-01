"use client"

import { SessionProvider } from "next-auth/react"
import { ThemeProvider } from "@/components/theme-provider"
import { Toaster } from "@/components/ui/toaster"
import { SessionValidatorWithSuspense } from "@/components/session-validator"
import { ReCaptchaProvider } from "@/components/recaptcha-provider"
import { useEffect, Suspense } from "react"
import { usePathname, useSearchParams } from "next/navigation"

// Force immediate session check
const ForceSessionCheck = () => {
  const pathname = usePathname();
  
  return (
    <Suspense fallback={null}>
      <SessionCheckContent pathname={pathname} />
    </Suspense>
  );
};

// Separate component that uses useSearchParams inside Suspense
const SessionCheckContent = ({ pathname }: { pathname: string }) => {
  const searchParams = useSearchParams();
  
  useEffect(() => {
    const publicRoutes = [
      '/login', 
      '/register', 
      '/forgot-password', 
      '/reset-password',
      '/verify-email',
      '/setup-mfa',
      '/waiting-approval'
    ];

    // Skip validation on any public route or if there's a noLoop parameter
    const isPublic = publicRoutes.some(route => pathname.startsWith(route));
    if (isPublic || searchParams.get('noLoop') === 'true') {
      return;
    }
    
    // Immediately validate session on page load
    const validateSession = async () => {
      try {
        // First try to validate the session
        const validateResponse = await fetch('/api/auth/validate');
        if (!validateResponse.ok) {
          // If validation fails, force logout by clearing cookies
          await fetch('/api/auth/force-logout?noRedirect=true');
          
          // Redirect to login page with noLoop parameter to prevent loops
          window.location.href = '/login?error=session_expired&noLoop=true';
        }
      } catch (error) {
        console.error("Error validating session on load:", error);
        
        // On error, try to force logout
        try {
          await fetch('/api/auth/force-logout?noRedirect=true');
          window.location.href = '/login?error=session_error&noLoop=true';
        } catch (e) {
          console.error("Failed to force logout:", e);
        }
      }
    };
    
    validateSession();
  }, [pathname, searchParams]);
  
  return null;
};

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <SessionProvider refetchInterval={5 * 60} refetchOnWindowFocus={false}>
      <ThemeProvider 
        attribute="class" 
        defaultTheme="system" 
        enableSystem 
        disableTransitionOnChange
      >
        <ReCaptchaProvider>
          {children}
          <Toaster />
          <SessionValidatorWithSuspense />
          <ForceSessionCheck />
        </ReCaptchaProvider>
      </ThemeProvider>
    </SessionProvider>
  )
} 