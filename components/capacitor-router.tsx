'use client';

import React, { createContext, useContext, useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';

interface RouteParams {
  [key: string]: string;
}

interface CapacitorRouterContextType {
  params: RouteParams;
  navigate: (path: string) => void;
  goBack: () => void;
}

const CapacitorRouterContext = createContext<CapacitorRouterContextType | undefined>(undefined);

export function CapacitorRouterProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [params, setParams] = useState<RouteParams>({});
  const [history, setHistory] = useState<string[]>([]);

  // Parse dynamic route parameters from the URL
  useEffect(() => {
    if (!pathname) return;

    // Add current path to history
    setHistory(prev => {
      if (prev[prev.length - 1] !== pathname) {
        return [...prev, pathname];
      }
      return prev;
    });

    // Extract parameters from URL path segments
    // Example: /employee/123 would extract { id: '123' }
    const pathSegments = pathname.split('/').filter(Boolean);
    const extractedParams: RouteParams = {};

    // Check for common parameter patterns in the URL
    pathSegments.forEach((segment, index) => {
      if (index > 0 && /^\d+$/.test(segment)) {
        // If segment is a number, assume it's an ID
        extractedParams.id = segment;
      } else if (index > 0 && segment.includes('-')) {
        // If segment contains hyphens, might be a slug
        extractedParams.slug = segment;
      }
    });

    // Special case for common routes
    if (pathname.includes('/employee/')) {
      const employeeId = pathname.split('/employee/')[1]?.split('/')[0];
      if (employeeId) extractedParams.employeeId = employeeId;
    }

    if (pathname.includes('/document/')) {
      const documentId = pathname.split('/document/')[1]?.split('/')[0];
      if (documentId) extractedParams.documentId = documentId;
    }

    setParams(extractedParams);
  }, [pathname]);

  // Navigation functions
  const navigate = (path: string) => {
    router.push(path);
  };

  const goBack = () => {
    if (history.length > 1) {
      const previousPath = history[history.length - 2];
      router.push(previousPath);
      setHistory(prev => prev.slice(0, -1));
    } else {
      // If no history, go to home
      router.push('/');
    }
  };

  const value = {
    params,
    navigate,
    goBack,
  };

  return (
    <CapacitorRouterContext.Provider value={value}>
      {children}
    </CapacitorRouterContext.Provider>
  );
}

// Hook to use the router
export function useCapacitorRouter() {
  const context = useContext(CapacitorRouterContext);
  if (context === undefined) {
    throw new Error('useCapacitorRouter must be used within a CapacitorRouterProvider');
  }
  return context;
} 