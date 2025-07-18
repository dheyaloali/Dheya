import { useState, useCallback } from "react";
import { mobileApi } from '@/lib/mobile-api-client';

interface UseMobileApiOptions {
  onSuccess?: (data: any) => void;
  onError?: (error: Error) => void;
}

/**
 * Hook for making API requests through the mobile gateway
 * 
 * This hook provides a consistent way to make API requests in the native app
 * while handling loading states and errors.
 */
export function useMobileApi<T = any>(options: UseMobileApiOptions = {}) {
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const [data, setData] = useState<T | null>(null);

  const { onSuccess, onError } = options;

  const get = useCallback(async (path: string, params?: Record<string, any>) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await mobileApi.get<T>(path, params);
      setData(response);
      onSuccess?.(response);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError]);

  const post = useCallback(async (path: string, data?: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await mobileApi.post<T>(path, data);
      setData(response);
      onSuccess?.(response);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError]);

  const put = useCallback(async (path: string, data?: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await mobileApi.put<T>(path, data);
      setData(response);
      onSuccess?.(response);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError]);

  const patch = useCallback(async (path: string, data?: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await mobileApi.patch<T>(path, data);
      setData(response);
      onSuccess?.(response);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError]);

  const remove = useCallback(async (path: string, data?: any) => {
    setIsLoading(true);
    setError(null);
    
    try {
      const response = await mobileApi.delete<T>(path, data);
      setData(response);
      onSuccess?.(response);
      return response;
    } catch (err) {
      const error = err instanceof Error ? err : new Error(String(err));
      setError(error);
      onError?.(error);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [onSuccess, onError]);

  return {
    isLoading,
    error,
    data,
    get,
    post,
    put,
    patch,
    delete: remove,
  };
}
 