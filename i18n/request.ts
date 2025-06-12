import {getRequestConfig} from 'next-intl/server';

export default getRequestConfig(async ({locale}) => {
  const safeLocale = locale || 'en';
  return {
    locale: safeLocale,
    messages: (await import(`../app/messages/${safeLocale}.json`)).default
  };
}); 