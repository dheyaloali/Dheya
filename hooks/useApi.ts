import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useToast } from '@/components/ui/use-toast';

/**
 * Custom hook for making API requests with session validation
 * Handles session invalidation by redirecting to login page
 */
export function useApi() {
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<Error | null>(null);
  const router = useRouter();
  const { toast } = useToast();

  /**
   * Fetch wrapper that handles session validation errors
   * @param url The URL to fetch
   * @param options Fetch options
   * @returns The response or null if session is invalid
   */
  const fetchWithSessionValidation = async (url: string, options: RequestInit = {}) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await fetch(url, options);
      
      // Handle session validation errors
      if (response.status === 401) {
        const data = await response.json();
        
        if (data.code === "SESSION_INVALID") {
          // Clear local session data
          localStorage.removeItem('user_session');
          
          // Show toast notification
          toast({
            title: "Session Expired",
            description: "Your session has expired or is invalid. Please log in again.",
            variant: "destructive",
          });
          
          // Redirect to login
          router.push('/login?error=session_expired');
          return null;
        }
      }
      
      return response;
    } catch (err) {
      setError(err as Error);
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * JSON fetch wrapper with session validation
   * @param url The URL to fetch
   * @param options Fetch options
   * @returns The parsed JSON response or null
   */
  const fetchJsonWithSessionValidation = async (url: string, options: RequestInit = {}) => {
    const response = await fetchWithSessionValidation(url, {
      ...options,
      headers: {
        ...options.headers,
        'Content-Type': 'application/json',
      },
    });
    
    if (!response) return null;
    
    try {
      return await response.json();
    } catch (err) {
      setError(err as Error);
      return null;
    }
  };

  return { 
    fetchWithSessionValidation,
    fetchJsonWithSessionValidation,
    isLoading,
    error
  };
} 