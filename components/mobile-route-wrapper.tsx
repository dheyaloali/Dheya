'use client';

import React, { useEffect } from 'react';
import { useMobile } from '../hooks/use-mobile';
import { CapacitorDetector } from './capacitor-detector';
import { Capacitor } from '@capacitor/core';

/**
 * This component provides a wrapper for mobile-specific functionality
 * when the app is running in a Capacitor native environment
 */
export function MobileRouteWrapper({ children }: { children: React.ReactNode }) {
  const { isNative } = useMobile();

  useEffect(() => {
    if (!isNative) {
      console.log('Running in web environment, skipping native initialization');
      return;
    }
    
    // Mobile-specific initialization
    console.log('Mobile route wrapper initialized in native environment');
    console.log('Capacitor platform:', Capacitor.getPlatform());
    
    // Add platform parameter to all links for middleware detection
    const addPlatformToLinks = () => {
      const links = document.querySelectorAll('a[href]');
      links.forEach(link => {
        const href = link.getAttribute('href');
        if (href && !href.includes('platform=native') && !href.startsWith('#') && !href.startsWith('tel:') && !href.startsWith('mailto:')) {
          const url = new URL(href, window.location.origin);
          url.searchParams.set('platform', 'native');
          link.setAttribute('href', url.toString());
        }
      });
    };
    
    // Handle query parameters for dynamic routes in static export
    const handleQueryParams = () => {
      const urlParams = new URLSearchParams(window.location.search);
      const id = urlParams.get('id');
      
      if (id) {
        console.log('Found ID in query parameters:', id);
        // You can use this ID to fetch data or pass it to components
      }
    };
    
    handleQueryParams();
    
    // Periodically update links to ensure new DOM elements are covered
    const intervalId = setInterval(addPlatformToLinks, 2000);
    
    // Listen for URL changes
    const handleRouteChange = () => {
      handleQueryParams();
      addPlatformToLinks();
    };
    
    window.addEventListener('popstate', handleRouteChange);
    
    return () => {
      window.removeEventListener('popstate', handleRouteChange);
      clearInterval(intervalId);
    };
  }, [isNative]);

  return (
    <>
      {/* Include the detector component that doesn't render anything */}
      <CapacitorDetector />
      {children}
    </>
  );
} 