export const dynamic = 'force-dynamic';

import { AuthLanguageSwitcher } from "@/components/AuthLanguageSwitcher"
import { cookies } from 'next/headers';
import { NextIntlClientProvider } from 'next-intl';

async function getMessages(locale: string) {
  if (locale === 'id') {
    return (await import('../messages/id.json')).default;
  }
  return (await import('../messages/en.json')).default;
}

export default async function AuthLayout({ children }: { children: React.ReactNode }) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'en';
  const messages = await getMessages(locale);

  return (
    <div className="min-h-screen bg-gray-50" suppressHydrationWarning>
      <div className="fixed top-4 right-4 z-50">
        <AuthLanguageSwitcher value={locale} />
      </div>
      <NextIntlClientProvider locale={locale} messages={messages}>
        {children}
      </NextIntlClientProvider>
    </div>
  );
} 