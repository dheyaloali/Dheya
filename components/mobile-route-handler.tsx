'use client';

import { useEffect } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { useMobile } from '../hooks/use-mobile';

/**
 * This component handles dynamic routes in a static export environment.
 * It detects URL patterns that would normally be handled by dynamic routes
 * and converts them to query parameter-based routes that work in static exports.
 */
export function MobileRouteHandler({ children }: { children: React.ReactNode }) {
  const { isNative } = useMobile();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  useEffect(() => {
    // Only apply this logic in native environments
    if (!isNative || !pathname) return;

    // Check for common dynamic route patterns
    const dynamicRoutePatterns = [
      { pattern: /\/employee\/(\d+)/, replacement: '/employee?id=$1' },
      { pattern: /\/employee\/(\d+)\/details/, replacement: '/employee/details?id=$1' },
      { pattern: /\/document\/(\d+)/, replacement: '/document?id=$1' },
      { pattern: /\/product\/(\d+)/, replacement: '/product?id=$1' },
      { pattern: /\/reports\/(\d+)/, replacement: '/reports?id=$1' },
      { pattern: /\/sales\/(\d+)/, replacement: '/sales?id=$1' },
    ];

    // Check if current path matches any dynamic route pattern
    for (const { pattern, replacement } of dynamicRoutePatterns) {
      const match = pathname.match(pattern);
      if (match) {
        const newPath = pathname.replace(pattern, replacement);
        
        // Preserve existing query params
        const existingParams = Array.from(searchParams.entries())
          .map(([key, value]: [string, string]) => `${key}=${value}`)
          .join('&');
        
        const redirectPath = existingParams 
          ? `${newPath}${newPath.includes('?') ? '&' : '?'}${existingParams}`
          : newPath;
        
        // Redirect to the query param version
        router.replace(redirectPath);
        return;
      }
    }
  }, [pathname, router, searchParams, isNative]);

  return <>{children}</>;
} 