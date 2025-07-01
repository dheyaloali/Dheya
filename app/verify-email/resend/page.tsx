"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { NextIntlClientProvider } from "next-intl";

function ResendVerificationContent() {
  const [email, setEmail] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [message, setMessage] = useState<{ type: "success" | "error"; text: string } | null>(null);
  const router = useRouter();
  const t = useTranslations('VerifyEmail');

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!email) {
      setMessage({ type: "error", text: t('enterEmailAddress') });
      return;
    }
    
    setIsSubmitting(true);
    setMessage(null);
    
    try {
      const response = await fetch("/api/auth/email-verification/resend", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ email }),
      });
      
      const data = await response.json();
      
      if (response.ok) {
        setMessage({ 
          type: "success", 
          text: t('successMessage')
        });
        // Redirect after a short delay
        setTimeout(() => {
          router.push("/login");
        }, 3000);
      } else {
        setMessage({ type: "error", text: data.message || t('failedToResend') });
      }
    } catch (error) {
      setMessage({ type: "error", text: t('failedToResend') });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center justify-center p-4">
      <div className="w-full max-w-md rounded-lg border bg-white p-8 shadow-md dark:border-gray-700 dark:bg-gray-800">
        <h1 className="mb-6 text-center text-2xl font-bold">{t('resendVerificationEmail')}</h1>
        
        {message && (
          <div className={`mb-4 rounded-md p-4 ${
            message.type === "success" 
              ? "bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-200" 
              : "bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-200"
          }`}>
            {message.text}
          </div>
        )}
        
        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="email" className="mb-2 block text-sm font-medium text-gray-900 dark:text-white">
              {t('enterEmail')}
            </label>
            <input
              type="email"
              id="email"
              className="block w-full rounded-lg border border-gray-300 bg-gray-50 p-2.5 text-gray-900 focus:border-blue-500 focus:ring-blue-500 dark:border-gray-600 dark:bg-gray-700 dark:text-white dark:placeholder-gray-400 dark:focus:border-blue-500 dark:focus:ring-blue-500"
              placeholder={t('enterEmailAddress')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>
          
          <button
            type="submit"
            disabled={isSubmitting}
            className="w-full rounded-lg bg-blue-600 px-5 py-2.5 text-center text-sm font-medium text-white hover:bg-blue-700 focus:outline-none focus:ring-4 focus:ring-blue-300 disabled:opacity-70 dark:bg-blue-500 dark:hover:bg-blue-600 dark:focus:ring-blue-800"
          >
            {isSubmitting ? t('sending') : t('resendVerificationEmail')}
          </button>
        </form>
        
        <div className="mt-4 text-center">
          <Link href="/login" className="text-sm text-blue-600 hover:underline dark:text-blue-400">
            {t('backToLogin')}
          </Link>
        </div>
      </div>
    </div>
  );
}

export default function ResendVerificationPage() {
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
      <ResendVerificationContent />
    </NextIntlClientProvider>
  );
} 