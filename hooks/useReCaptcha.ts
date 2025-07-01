import { useContext, useCallback } from 'react';
import { ReCaptchaContext } from '@/components/recaptcha-provider';

// Hook to use reCAPTCHA functionality
export function useReCaptcha() {
  const { ready } = useContext(ReCaptchaContext);

  // Function to execute reCAPTCHA and get a token
  const executeReCaptcha = useCallback(async (action: string): Promise<string> => {
    // Check if we're in a browser environment and reCAPTCHA is ready
    if (typeof window === 'undefined' || !ready) {
      return '';
    }

    try {
      // Get the reCAPTCHA site key from environment variables
      const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY;
      
      // If no site key is available, return empty string
      if (!siteKey) {
        console.warn('NEXT_PUBLIC_RECAPTCHA_SITE_KEY is not defined');
        return '';
      }

      // Execute reCAPTCHA
      if (window.grecaptcha && window.grecaptcha.execute) {
        const token = await window.grecaptcha.execute(siteKey, { action });
        return token;
      } else {
        console.error('ReCAPTCHA not loaded');
        return '';
      }
    } catch (error) {
      console.error('Error executing reCAPTCHA:', error);
      return '';
    }
  }, [ready]);

  return {
    ready,
    executeReCaptcha,
  };
}

// Add global type for grecaptcha
declare global {
  interface Window {
    grecaptcha: {
      execute: (siteKey: string, options: { action: string }) => Promise<string>;
      ready: (callback: () => void) => void;
    };
  }
} 