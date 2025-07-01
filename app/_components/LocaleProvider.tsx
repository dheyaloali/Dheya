'use client';

import { NextIntlClientProvider } from 'next-intl';
import { usePathname } from 'next/navigation';
import { useEffect, useState } from 'react';

// Define locales directly here to avoid import issues
export const locales = ['en', 'id'];
export const defaultLocale = 'en';

export function LocaleProvider({ children }: { children: React.ReactNode }) {
  const [messages, setMessages] = useState<Record<string, string> | null>(null);
  const [locale, setLocale] = useState(defaultLocale);
  const pathname = usePathname();

  // Get locale from cookie or pathname
  useEffect(() => {
    // Try to get locale from cookie first
    const cookieLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1];
    
    // Try to get locale from pathname
    const pathnameLocale = pathname.split('/')[1];
    const detectedLocale = 
      (cookieLocale && locales.includes(cookieLocale)) ? cookieLocale :
      (pathnameLocale && locales.includes(pathnameLocale)) ? pathnameLocale :
      defaultLocale;
    
    setLocale(detectedLocale);

    // Load messages
    import(`../messages/${detectedLocale}.json`)
      .then(module => {
        setMessages(module.default);
      })
      .catch(error => {
        console.error(`Failed to load messages for locale: ${detectedLocale}`, error);
        // Fallback to default locale
        import(`../messages/${defaultLocale}.json`)
          .then(module => {
            setMessages(module.default);
            setLocale(defaultLocale);
          })
          .catch(fallbackError => {
            console.error(`Failed to load fallback messages`, fallbackError);
          });
      });
  }, [pathname]);

  if (!messages) {
    // Show minimal loading state
    return <div className="min-h-screen flex items-center justify-center">Loading...</div>;
  }

  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      {children}
    </NextIntlClientProvider>
  );
} 