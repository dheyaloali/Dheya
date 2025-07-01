import 'server-only';
import {getRequestConfig} from 'next-intl/server';
import {notFound} from 'next/navigation';
import {cookies} from 'next/headers';

// Define the locales we support
export const locales = ['en', 'id'] as const;
export const defaultLocale = 'en';

// This is the dictionary type
type Dictionary = {
  [key: string]: {
    [key: string]: string;
  };
};

// Create a dictionary loader for each locale
const dictionaries: { [key: string]: () => Promise<Dictionary> } = {
  en: () => import('./messages/en.json').then((module) => module.default),
  id: () => import('./messages/id.json').then((module) => module.default),
};

export const getDictionary = async (locale: string) => {
  if (!locales.includes(locale as any)) {
    notFound();
  }
  
  return dictionaries[locale]();
};

export default getRequestConfig(async () => {
  // Read the locale from the cookie
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || defaultLocale;
  
  // Validate that the incoming `locale` parameter is valid
  if (!locales.includes(locale as any)) notFound();
  
  // Ensure locale is never undefined, default to 'en'
  const safeLocale = locale || 'en';
  
  try {
    // Load messages for the current locale
    const messages = (await import(`./messages/${safeLocale}.json`)).default;

    return {
      locale: safeLocale,
      messages,
      timeZone: 'UTC',
      formats: {
        dateTime: {
          short: {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }
        }
      },
      onError: (error) => {
        // Log internationalization errors
        console.error('[i18n error]', error);
      },
      getMessageFallback: ({namespace, key}) => {
        // Provide fallback messages when a translation is missing
        const path = namespace ? `${namespace}.${key}` : key;
        console.warn(`[i18n missing]: ${path}`);
        return `${key}`;
      }
    };
  } catch (error) {
    console.error(`[i18n] Failed to load messages for locale: ${safeLocale}`, error);
    
    // Fallback to English if the requested locale fails
    const fallbackMessages = (await import(`./messages/en.json`)).default;
    
    return {
      locale: 'en',
      messages: fallbackMessages,
      timeZone: 'UTC',
      formats: {
        dateTime: {
          short: {
            day: 'numeric',
            month: 'short',
            year: 'numeric'
          }
        }
      },
      onError: (error) => {
        console.error('[i18n error]', error);
      },
      getMessageFallback: ({namespace, key}) => {
        const path = namespace ? `${namespace}.${key}` : key;
        console.warn(`[i18n missing]: ${path}`);
        return `${key}`;
      }
    };
  }
}); 