"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState } from "react";
import { NextIntlClientProvider } from "next-intl";

function VerifyEmailSuccessContent() {
  const t = useTranslations('VerifyEmail');
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-green-100 p-3 dark:bg-green-900">
            <svg
              className="h-8 w-8 text-green-500 dark:text-green-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M5 13l4 4L19 7"
              />
            </svg>
          </div>
        </div>
        <h1 className="mb-4 text-center text-2xl font-bold">{t('emailVerified')}</h1>
        <p className="mb-6 text-center text-gray-600 dark:text-gray-300">
          {t('thankYouForVerifying')}
        </p>
        <div className="flex justify-center">
          <Link
            href="/login"
            className="rounded-md bg-blue-600 px-4 py-2 text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {t('goToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function VerifyEmailSuccessPage() {
  const [locale, setLocale] = useState('en');
  const [messages, setMessages] = useState<any>(null);

  useEffect(() => {
    const cookieLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1] || 'en';
    setLocale(cookieLocale);
    import(`../../messages/${cookieLocale}.json`).then(mod => setMessages(mod.default));
  }, []);

  if (!messages) {
    return null; // or a loading spinner
  }

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <VerifyEmailSuccessContent />
    </NextIntlClientProvider>
  );
} 