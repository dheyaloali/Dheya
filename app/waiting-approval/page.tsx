"use client"

import { useSession } from "next-auth/react"
import { useRouter } from "next/navigation"
import { useEffect, useState } from "react"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { signOut } from "next-auth/react"
import { EmployeeDocumentsContent } from "@/components/employee/documents-content"
import { Skeleton } from "@/components/ui/skeleton"
import { NextIntlClientProvider } from "next-intl";
import { useTranslations } from 'next-intl';

function WaitingApprovalContent() {
  const t = useTranslations('WaitingApproval');
  const { data: session, status } = useSession();
  const router = useRouter();

  useEffect(() => {
    if (
      status === "authenticated" &&
      (session?.user && (session.user as any).isApproved)
    ) {
      router.replace("/employee/dashboard")
    }
  }, [session, status, router]);

  if (status === "loading") {
    return (
      <div className="container flex flex-col items-center justify-center min-h-screen py-12">
        <Card className="w-full max-w-md mb-8">
          <CardHeader>
            <CardTitle className="text-2xl text-center">{t('registrationPending')}</CardTitle>
            <CardDescription className="text-center">
              {t('waitingForApproval')}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="text-center text-muted-foreground">
              <p>{t('thankYouForRegistering')}</p>
              <p>{t('underReview')}</p>
              <p>{t('notifiedWhenApproved')}</p>
            </div>
            <div className="flex justify-center">
              <Button
                variant="outline"
                onClick={() => signOut({ callbackUrl: "/" })}
              >
                {t('signOut')}
              </Button>
            </div>
          </CardContent>
        </Card>
        <div className="w-full max-w-3xl">
          <h2 className="text-xl font-semibold mb-2 text-center">{t('uploadYourDocuments')}</h2>
          <p className="text-center text-muted-foreground mb-4">{t('uploadInstructions')}</p>
          <Skeleton className="w-full h-96 rounded-xl" />
        </div>
      </div>
    );
  }

  return (
    <div className="container flex flex-col items-center justify-center min-h-screen py-12">
      <Card className="w-full max-w-md mb-8">
        <CardHeader>
          <CardTitle className="text-2xl text-center">{t('registrationPending')}</CardTitle>
          <CardDescription className="text-center">
            {t('waitingForApproval')}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="text-center text-muted-foreground">
            <p>{t('thankYouForRegistering')}</p>
            <p>{t('underReview')}</p>
            <p>{t('notifiedWhenApproved')}</p>
          </div>
          <div className="flex justify-center">
            <Button
              variant="outline"
              onClick={() => signOut({ callbackUrl: "/" })}
            >
              {t('signOut')}
            </Button>
          </div>
        </CardContent>
      </Card>
      <div className="w-full max-w-3xl">
        <h2 className="text-xl font-semibold mb-2 text-center">{t('uploadYourDocuments')}</h2>
        <p className="text-center text-muted-foreground mb-4">{t('uploadInstructions')}</p>
        <EmployeeDocumentsContent />
      </div>
    </div>
  );
}

export default function WaitingApproval() {
  const [locale, setLocale] = useState('en');
  const [messages, setMessages] = useState<any>(null);

  useEffect(() => {
    const cookieLocale = document.cookie
      .split('; ')
      .find(row => row.startsWith('locale='))
      ?.split('=')[1] || 'en';
    setLocale(cookieLocale);
    import(`../messages/${cookieLocale}.json`).then(mod => setMessages(mod.default));
  }, []);

  if (!messages) {
    return null; // or a loading spinner
  }

  return (
    <NextIntlClientProvider messages={messages} locale={locale}>
      <WaitingApprovalContent />
    </NextIntlClientProvider>
  );
} 