import { EmployeeLayout } from "@/components/layouts/employee-layout"
import { Toaster } from "@/components/ui/toaster"
import { NextIntlClientProvider } from 'next-intl';
import { cookies } from 'next/headers';

export default async function EmployeeRootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const cookieStore = await cookies();
  const locale = cookieStore.get('locale')?.value || 'en';
  
  // Load messages directly without caching
  let messages;
  try {
    messages = await import(`../messages/${locale}.json`).then(mod => mod.default);
    
    // Debug logging
    console.log('Loaded messages for locale:', locale);
    console.log('Dashboard messages:', messages.Dashboard);
    
    // Validate required messages
    if (!messages.Dashboard) {
      console.error('Missing Dashboard messages');
      throw new Error('Missing Dashboard messages');
    }
    
    // Ensure required keys exist
    const requiredKeys = ['noDetails', 'view', 'edit'];
    const missingKeys = requiredKeys.filter(key => !messages.Dashboard[key]);
    if (missingKeys.length > 0) {
      console.error('Missing required Dashboard keys:', missingKeys);
      throw new Error(`Missing required Dashboard keys: ${missingKeys.join(', ')}`);
    }
  } catch (error) {
    console.error('Failed to load messages:', error);
    // Fallback to English
    messages = await import(`../messages/en.json`).then(mod => mod.default);
  }
  
  return (
    <NextIntlClientProvider locale={locale} messages={messages}>
      <Toaster />
      <EmployeeLayout>{children}</EmployeeLayout>
    </NextIntlClientProvider>
  );
} 