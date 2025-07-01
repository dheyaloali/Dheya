"use client";

import Link from "next/link";
import { useTranslations } from "next-intl";
import { useEffect, useState, Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";

function VerifyEmailErrorContent() {
  const t = useTranslations('VerifyEmail');
  
  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <div className="mb-6 flex justify-center">
          <div className="rounded-full bg-red-100 p-3 dark:bg-red-900">
            <svg
              className="h-8 w-8 text-red-500 dark:text-red-400"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </div>
        </div>
        <h1 className="mb-4 text-center text-2xl font-bold">{t('verificationFailed')}</h1>
        <p className="mb-6 text-center text-gray-600 dark:text-gray-300">
          {t('linkExpiredOrInvalid')}
        </p>
        <div className="flex flex-col space-y-4">
          <Link
            href="/verify-email/resend"
            className="rounded-md bg-blue-600 px-4 py-2 text-center text-white transition-colors hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 dark:bg-blue-500 dark:hover:bg-blue-600"
          >
            {t('resendVerificationEmail')}
          </Link>
          <Link
            href="/login"
            className="rounded-md bg-gray-200 px-4 py-2 text-center text-gray-800 transition-colors hover:bg-gray-300 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 dark:bg-gray-700 dark:text-white dark:hover:bg-gray-600"
          >
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}

function VerifyEmailErrorPage() {
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
      <VerifyEmailErrorContent />
    </NextIntlClientProvider>
  );
}

export default function VerifyEmailErrorPageWrapper() {
  return (
    <Suspense fallback={null}>
      <VerifyEmailErrorPage />
    </Suspense>
  );
} 