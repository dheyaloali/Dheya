"use client";

import React, { createContext, useContext, useState, useEffect } from 'react';
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';

// Define the context
interface CapacitorApiContextType {
  isNative: boolean;
  isOnline: boolean;
  apiCall: <T>(url: string, options?: RequestInit) => Promise<T>;
  storeData: (key: string, value: string) => Promise<void>;
  getData: (key: string) => Promise<string | null>;
  removeData: (key: string) => Promise<void>;
  pendingRequests: number;
}

const CapacitorApiContext = createContext<CapacitorApiContextType | undefined>(undefined);

// API base URL - this will be used in native apps
const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3000';

export function CapacitorApiProvider({ children }: { children: React.ReactNode }) {
  const [isNative, setIsNative] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingRequests, setPendingRequests] = useState(0);
  const [offlineQueue, setOfflineQueue] = useState<{url: string, options: RequestInit}[]>([]);
  const [cookiesInitialized, setCookiesInitialized] = useState(false);

  useEffect(() => {
    // Check if running in Capacitor
    const nativeCheck = Capacitor.isNativePlatform();
    setIsNative(nativeCheck);
    
    // Store original fetch for cleanup
    const originalFetch = window.fetch;
    
    // Add a custom header to all fetch requests when in native mode
    if (nativeCheck) {
      console.log('Setting up native app headers for all fetch requests');
      
      // Enhanced cookie handling for native app
      const initCookieHandling = async () => {
        try {
          // Import CapacitorCookies dynamically to avoid SSR issues
          const { CapacitorCookies } = await import('@capacitor/core');
          
          // Don't clear cookies on initialization as it might cause logout
          // Instead, ensure cookies are properly synchronized
          
          // Set a flag to indicate cookies are initialized
          setCookiesInitialized(true);
          console.log('Capacitor Cookies initialized');
          
          // Attempt to retrieve and log cookies for debugging
          try {
            const cookies = document.cookie;
            console.log('Current cookies:', cookies);
          } catch (e) {
            console.error('Error reading cookies:', e);
          }
        } catch (error) {
          console.error('Error initializing Capacitor Cookies:', error);
        }
      };
      
      initCookieHandling();
      
      window.fetch = async function(input, init) {
        const modifiedInit = init || {};
        const headers = {
          ...(modifiedInit.headers || {}),
          'x-app-type': 'native',
          'x-capacitor-platform': Capacitor.getPlatform()
        };
        
        // --- Native: Add JWT Authorization Header ---
        try {
          const { value: jwt } = await Preferences.get({ key: 'jwt' });
          if (jwt) {
            (headers as any)['Authorization'] = `Bearer ${jwt}`;
            console.log('[Native] Added JWT Authorization header');
          }
        } catch (error) {
          console.warn('[Native] Error getting JWT from Preferences:', error);
        }
        
        modifiedInit.headers = headers;
        
        // Add platform parameter to URLs
        let url = input;
        if (typeof url === 'string') {
          try {
            // Only modify relative URLs or URLs to our own domain
            if (url.startsWith('/') || url.includes(window.location.host)) {
              const urlObj = new URL(url, window.location.origin);
              urlObj.searchParams.set('platform', 'native');
              url = urlObj.toString();
            }
          } catch (e) {
            console.error('Error modifying URL:', e);
          }
        }
        
        // Ensure cookies are properly handled
        modifiedInit.credentials = 'include';
        
        console.log('Native fetch:', { url, headers: modifiedInit.headers });
        
        const fetchPromise = originalFetch(url, modifiedInit);
        
        // Enhanced cookie synchronization after each request
        fetchPromise.then(async (response) => {
          try {
            // Only sync cookies for requests to our domain
            if (typeof url === 'string' && 
                (url.startsWith('/') || url.includes(window.location.host))) {
              
              const { CapacitorCookies } = await import('@capacitor/core');
              
              // Log cookies for debugging
              const cookies = document.cookie;
              console.log('Cookies after fetch:', cookies);
              
              // Explicitly get Set-Cookie headers if available
              const setCookieHeader = response.headers.get('set-cookie');
              if (setCookieHeader) {
                console.log('Set-Cookie header found:', setCookieHeader);
              }
            }
          } catch (error) {
            console.error('Error with cookies after fetch:', error);
          }
        });
        
        return fetchPromise;
      };
    }

    // Set up network status listener
    const setupNetworkListener = async () => {
      // Initial network status
      const status = await Network.getStatus();
      setIsOnline(status.connected);

      // Listen for network status changes
      Network.addListener('networkStatusChange', (status) => {
        setIsOnline(status.connected);
      });
    };

    setupNetworkListener();

    return () => {
      // Clean up network listener
      Network.removeAllListeners();
      
      // Restore original fetch if we modified it
      if (nativeCheck) {
        window.fetch = originalFetch;
      }
    };
  }, []);

  // Process offline queue when back online
  useEffect(() => {
    if (isOnline && offlineQueue.length > 0) {
      const processQueue = async () => {
        console.log(`Processing ${offlineQueue.length} offline requests`);
        
        // Create a copy of the queue
        const queue = [...offlineQueue];
        
        // Clear the queue
        setOfflineQueue([]);
        
        // Process each request
        for (const request of queue) {
          try {
            await fetch(request.url, request.options);
          } catch (error) {
            console.error('Error processing offline request:', error);
          }
        }
      };
      
      processQueue();
    }
  }, [isOnline, offlineQueue]);

  // API call function with enhanced cookie handling
  const apiCall = async <T,>(url: string, options: RequestInit = {}): Promise<T> => {
    // Increment pending requests
    setPendingRequests(prev => prev + 1);
    
    try {
      // Use absolute URL for native apps
      const fullUrl = isNative ? `${API_BASE_URL}${url}` : url;
      
      // Add native app headers if in native mode
      if (isNative) {
        options.headers = {
          ...options.headers,
          'x-app-type': 'native',
          'x-capacitor-platform': Capacitor.getPlatform()
        };
        
        // --- Native: Add JWT Authorization Header ---
        try {
          const { value: jwt } = await Preferences.get({ key: 'jwt' });
          if (jwt) {
            (options.headers as any)['Authorization'] = `Bearer ${jwt}`;
            console.log('[Native] Added JWT Authorization header to apiCall');
          }
        } catch (error) {
          console.warn('[Native] Error getting JWT from Preferences in apiCall:', error);
        }
        
        // Always include credentials for cookie handling
        options.credentials = 'include';
      }
      
      // If offline, queue the request for later
      if (!isOnline) {
        setOfflineQueue(prev => [...prev, { url: fullUrl, options }]);
        throw new Error('Offline - request queued');
      }
      
      // Make the request
      const response = await fetch(fullUrl, options);
      
      // Check if response is OK
      if (!response.ok) {
        throw new Error(`API error: ${response.status}`);
      }
      
      // Parse the response
      const data = await response.json();
      return data as T;
    } catch (error) {
      console.error('API call error:', error);
      throw error;
    } finally {
      // Decrement pending requests
      setPendingRequests(prev => prev - 1);
    }
  };

  // Storage functions
  const storeData = async (key: string, value: string): Promise<void> => {
    if (isNative) {
      await Preferences.set({ key, value });
    } else {
      localStorage.setItem(key, value);
    }
  };
  
  const getData = async (key: string): Promise<string | null> => {
    if (isNative) {
      const { value } = await Preferences.get({ key });
      return value;
    } else {
      return localStorage.getItem(key);
    }
  };
  
  const removeData = async (key: string): Promise<void> => {
    if (isNative) {
      await Preferences.remove({ key });
    } else {
      localStorage.removeItem(key);
    }
  };

  const value = {
    isNative,
    isOnline,
    apiCall,
    storeData,
    getData,
    removeData,
    pendingRequests,
  };

  return (
    <CapacitorApiContext.Provider value={value}>
      {children}
    </CapacitorApiContext.Provider>
  );
}

// Hook to use the context
export function useCapacitorApi() {
  const context = useContext(CapacitorApiContext);
  if (context === undefined) {
    throw new Error('useCapacitorApi must be used within a CapacitorApiProvider');
  }
  return context;
} 