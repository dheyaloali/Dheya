"use client";

import { createContext, useEffect, useState } from "react";
import Script from "next/script";

// Create context for reCAPTCHA
export const ReCaptchaContext = createContext({
  ready: false,
});

export function ReCaptchaProvider({ children }: { children: React.ReactNode }) {
  const [ready, setReady] = useState(false);
  const siteKey = process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || "";

  // Handle script load event
  const handleLoad = () => {
    if (window.grecaptcha) {
      window.grecaptcha.ready(() => {
        setReady(true);
      });
    }
  };

  return (
    <ReCaptchaContext.Provider value={{ ready }}>
      <Script
        src={`https://www.google.com/recaptcha/api.js?render=${siteKey}`}
        onLoad={handleLoad}
        strategy="afterInteractive"
      />
      {children}
    </ReCaptchaContext.Provider>
  );
} 