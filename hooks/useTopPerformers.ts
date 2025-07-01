import useSWR from 'swr';
import { useState, useRef, useCallback, useEffect } from 'react';
import { adminFetcher } from '@/lib/admin-api-client';

// Define interfaces for type safety
interface TopProduct {
  name: string;
  amount: number;
  quantity?: number;
  image?: string;
}

interface TopPerformer {
  id: number;
  name: string;
  location: string;
  sales: number;
  topProducts: TopProduct[];
  avatar?: string;
}

interface TopPerformersResponse {
  performers: TopPerformer[];
  total: number;
};

export function useTopPerformers(initialPage = 1, initialPageSize = 10, city?: string) {
  const [page, setPage] = useState(initialPage);
  const [pageSize, setPageSize] = useState(initialPageSize);
  
  // Track last fetch time for conditional revalidation
  const lastFetchTimeRef = useRef<number>(0);
  
  // Build the query URL with parameters
  const cityParam = city && city !== 'All' ? `&city=${encodeURIComponent(city)}` : '';
  const url = `/api/admin/top-performers?limit=${pageSize}&offset=${(page - 1) * pageSize}${cityParam}`;
  
  // Custom revalidation condition - only revalidate if it's been more than 2 minutes
  const shouldRevalidate = useCallback(() => {
    const now = Date.now();
    const timeSinceLastFetch = now - lastFetchTimeRef.current;
    const shouldRefresh = timeSinceLastFetch > 2 * 60 * 1000; // 2 minutes
    
    if (shouldRefresh) {
      lastFetchTimeRef.current = now;
    }
    
    return shouldRefresh;
  }, []);
  
  const { data, error, isLoading, mutate } = useSWR<TopPerformersResponse>(
    url, 
    adminFetcher,
    {
      revalidateOnFocus: false, // Don't revalidate on focus - use our custom condition
      revalidateIfStale: true,
      revalidateOnReconnect: true,
      refreshInterval: 60000,       // Refresh every 60 seconds (increased from 30s)
      dedupingInterval: 30000,      // Prevent duplicate requests within 30 seconds
      errorRetryCount: 3,           // Retry failed requests 3 times
      keepPreviousData: true,       // Keep showing previous data while loading new data
      onErrorRetry: (error, key, config, revalidate, { retryCount }) => {
        // Never retry on 404s or rate limit errors
        if (error.status === 404 || error.status === 429) return;
        
        // Only retry up to specified count
        if (retryCount >= (config.errorRetryCount || 3)) return;
        
        // Retry with exponential backoff
        setTimeout(() => revalidate({ retryCount }), 
          Math.min(1000 * 2 ** retryCount, 30000)
        );
      }
    }
  );
  
  // Custom refresh function that respects our time-based condition
  const refresh = useCallback(() => {
    // Always update the last fetch time when manually refreshing
    lastFetchTimeRef.current = Date.now();
    return mutate();
  }, [mutate]);
  
  // When tab gets focus, conditionally revalidate
  const handleFocus = useCallback(() => {
    if (shouldRevalidate()) {
      mutate();
    }
  }, [shouldRevalidate, mutate]);
  
  // Add event listener for focus events
  useEffect(() => {
    if (typeof window !== 'undefined') {
      window.addEventListener('focus', handleFocus);
      
      // Clean up event listener
      return () => {
        window.removeEventListener('focus', handleFocus);
      };
    }
  }, [handleFocus]);
  
  return {
    performers: data?.performers || [],
    total: data?.total || 0,
    page,
    pageSize,
    setPage,
    setPageSize,
    isLoading,
    error,
    refresh
  };
} 