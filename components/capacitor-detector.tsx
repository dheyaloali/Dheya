/**
 * Enhanced Capacitor Platform Detector
 * 
 * This component provides robust detection of Capacitor/native platform
 * and sets appropriate headers for middleware to identify native app requests.
 */
'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';

// Add Capacitor to Window interface
declare global {
  interface Window {
    Capacitor?: any;
    cordova?: any;
  }
}

// Define the detection strategies and their priorities
const DETECTION_STRATEGIES = {
  CAPACITOR_OBJECT: {
    name: 'Capacitor global object',
    priority: 1,
  },
  USER_AGENT: {
    name: 'User agent patterns',
    priority: 2,
  },
  PLATFORM_FEATURES: {
    name: 'Native platform features',
    priority: 3,
  },
  CORDOVA_OBJECT: {
    name: 'Cordova global object',
    priority: 4,
  },
};

// Immediately set up fetch interception for native app detection
// This runs as soon as this file is imported, before any components mount
if (typeof window !== 'undefined') {
  // Simple detection for native environment
  const isNativeEnv = 
    (window.Capacitor !== undefined) || 
    /capacitor|cordova|android|ios|iphone|ipad/i.test(navigator.userAgent) ||
    (window.cordova !== undefined);
  
  if (isNativeEnv) {
    console.log('Native environment detected, setting up fetch interception immediately');
    localStorage.setItem('isNativeApp', 'true');
    
    // Inject platform info into all fetch requests
    const originalFetch = window.fetch;
    window.fetch = function(input, init) {
      const modifiedInit = {
        ...init,
        headers: {
          ...(init?.headers || {}),
          'x-capacitor-platform': 'android', // Default to Android
          'x-app-type': 'native',
        }
      };
      return originalFetch.call(this, input, modifiedInit);
    };
  }
}

// Default export function
export default function CapacitorDetector() {
  const [isNative, setIsNative] = useState<boolean | null>(null);
  const [detectionMethod, setDetectionMethod] = useState<string | null>(null);
  const pathname = usePathname();
  const router = useRouter();

  // Enhanced detection logic with multiple strategies
  useEffect(() => {
    // Prevent execution during SSR
    if (typeof window === 'undefined') return;

    const detectCapacitor = async () => {
      let detected = false;
      let method = null;

      try {
        // Strategy 1: Check for Capacitor global object (highest priority)
        if (window.Capacitor) {
          detected = true;
          method = DETECTION_STRATEGIES.CAPACITOR_OBJECT.name;
          console.log('Capacitor detected via global object');
        }
        // Strategy 2: Check user agent for mobile app patterns
        else if (
          /capacitor|cordova|android|ios|iphone|ipad/i.test(navigator.userAgent)
        ) {
          detected = true;
          method = DETECTION_STRATEGIES.USER_AGENT.name;
          console.log('Capacitor detected via user agent:', navigator.userAgent);
        }
        // Strategy 3: Try to use platform-specific features
        else {
          // Try to dynamically import Capacitor core
          try {
            const { Capacitor } = await import('@capacitor/core');
            if (Capacitor && Capacitor.isNativePlatform()) {
              detected = true;
              method = DETECTION_STRATEGIES.PLATFORM_FEATURES.name;
              console.log('Capacitor detected via dynamic import');
            }
          } catch (e) {
            console.log('Capacitor dynamic import failed:', e);
          }
        }

        // Strategy 4: Check for Cordova as fallback
        if (!detected && window.cordova) {
          detected = true;
          method = DETECTION_STRATEGIES.CORDOVA_OBJECT.name;
          console.log('Cordova detected via global object');
        }

        // Set detection results
        setIsNative(detected);
        setDetectionMethod(method);

        // Set custom headers for future requests if we're in a native app
        if (detected) {
          // Add platform information to localStorage for other components
          localStorage.setItem('isNativeApp', 'true');
          localStorage.setItem('nativeDetectionMethod', method || 'unknown');
          
          console.log('Capacitor detection complete - running in native app');
      } else {
          localStorage.removeItem('isNativeApp');
          localStorage.removeItem('nativeDetectionMethod');
          console.log('Capacitor detection complete - running in browser');
        }
      } catch (error) {
        console.error('Error during Capacitor detection:', error);
        setIsNative(false);
      }
    };

    detectCapacitor();
  }, []);
  
  // Redirect employee users to the app-required page if not in native app
  useEffect(() => {
    if (isNative === false && pathname?.startsWith('/employee') && !pathname.includes('employee-app-required')) {
      console.log('Employee route detected in browser - redirecting to app-required page');
      router.push('/employee-app-required');
    }
  }, [isNative, pathname, router]);

  // This component doesn't render anything visible
  return null;
}

// Export the named version as well, but using the same implementation
export { CapacitorDetector as CapacitorDetector }; 
