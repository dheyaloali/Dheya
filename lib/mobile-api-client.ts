/**
 * Mobile API Client
 * 
 * A client-side utility for making API requests through the mobile gateway.
 * This solves the issue with dynamic routes in static exports for Capacitor.
 */

type HttpMethod = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

interface MobileApiOptions {
  params?: Record<string, any>;
  data?: any;
  headers?: Record<string, string>;
}

const API_URL = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
const GATEWAY_ENDPOINT = `${API_URL}/api/mobile-gateway`;

/**
 * Makes an API request through the mobile gateway
 */
export async function mobileApiRequest<T = any>(
  path: string,
  method: HttpMethod = 'GET',
  options: MobileApiOptions = {}
): Promise<T> {
  const { params = {}, data = null, headers = {} } = options;
  
  try {
    // Make sure path starts with a slash
    const normalizedPath = path.startsWith('/') ? path : `/${path}`;
    
    // Make the request to the gateway
    const response = await fetch(GATEWAY_ENDPOINT, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...headers
      },
      body: JSON.stringify({
        path: normalizedPath,
        method,
        params,
        data
      })
    });
    
    // Parse the response
    const result = await response.json();
    
    // Handle error responses
    if (!response.ok) {
      throw new Error(result.error || 'API request failed');
    }
    
    return result as T;
  } catch (error) {
    console.error(`[Mobile API] ${method} ${path} failed:`, error);
    throw error;
  }
}

/**
 * Convenience methods for different HTTP methods
 */
export const mobileApi = {
  get: <T = any>(path: string, params?: Record<string, any>, headers?: Record<string, string>) => 
    mobileApiRequest<T>(path, 'GET', { params, headers }),
    
  post: <T = any>(path: string, data?: any, headers?: Record<string, string>) => 
    mobileApiRequest<T>(path, 'POST', { data, headers }),
    
  put: <T = any>(path: string, data?: any, headers?: Record<string, string>) => 
    mobileApiRequest<T>(path, 'PUT', { data, headers }),
    
  patch: <T = any>(path: string, data?: any, headers?: Record<string, string>) => 
    mobileApiRequest<T>(path, 'PATCH', { data, headers }),
    
  delete: <T = any>(path: string, data?: any, headers?: Record<string, string>) => 
    mobileApiRequest<T>(path, 'DELETE', { data, headers })
}; 