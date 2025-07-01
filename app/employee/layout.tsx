import { ReactNode, Suspense } from "react";
import { NextIntlClientProvider } from "next-intl";
import { getLocale } from "@/lib/i18n";
import { EmployeeProvider } from "@/components/providers/employee-provider";
import { sidebarProvider as SidebarProvider } from "@/components/ui/employee/sidebar-provider";
import { EmployeeLayout } from "@/components/layouts/employee-layout";
import { getServerSession } from "next-auth";
import { authOptions } from "@/lib/auth";
import { redirect } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { headers } from "next/headers";
import jwt from "jsonwebtoken";

// Platform detection constants
const NATIVE_APP_HEADER = 'x-capacitor-platform';
const NATIVE_APP_USER_AGENT_PATTERNS = ['capacitor', 'cordova', 'android', 'ios'];

/**
 * Detects if the request is coming from a native app
 */
async function isNativeAppRequest(): Promise<boolean> {
  const headersList = await headers();
  
  // Check for Capacitor platform header
  const capacitorPlatform = headersList.get(NATIVE_APP_HEADER);
  if (capacitorPlatform) {
    return true;
  }

  // Check user agent for native app patterns
  const userAgent = headersList.get('user-agent')?.toLowerCase() || '';
  if (NATIVE_APP_USER_AGENT_PATTERNS.some(pattern => userAgent.includes(pattern))) {
    return true;
  }

  // Check for custom headers that might be set by our native app
  const isNativeApp = headersList.get('x-app-type') === 'native';
  if (isNativeApp) {
    return true;
  }

  return false;
}

/**
 * Extracts and validates JWT token from Authorization header
 */
async function validateJWTFromHeader(): Promise<any | null> {
  try {
    const headersList = await headers();
    const authHeader = headersList.get('authorization');
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return null;
    }

    const token = authHeader.substring(7); // Remove 'Bearer ' prefix
    
    // Decode the JWT token
    const decoded = jwt.verify(token, process.env.NEXTAUTH_SECRET!);
    return decoded;
  } catch (error) {
    console.error('JWT validation error in layout:', error);
    return null;
  }
}

// Get messages for the client component
async function getMessages(locale: string) {
  try {
  return (await import(`../messages/${locale}.json`)).default;
  } catch (error) {
    console.error(`Failed to load messages for locale: ${locale}`, error);
    // Fallback to English if the requested locale's messages can't be loaded
    return (await import(`../messages/en.json`)).default;
  }
}

export default async function EmployeeRootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const isNative = await isNativeAppRequest();
  let session: any = null;
  
  if (isNative) {
    // For native requests, try to validate JWT from Authorization header
    const jwtPayload = await validateJWTFromHeader();
    if (jwtPayload) {
      // Create a session-like object from JWT payload
      session = {
        user: {
          id: jwtPayload.userId || jwtPayload.id as string,
          name: jwtPayload.name as string,
          email: jwtPayload.email as string,
          isAdmin: jwtPayload.isAdmin as boolean,
          role: jwtPayload.role as string,
          isApproved: jwtPayload.isApproved as boolean,
        }
      };
    }
  } else {
    // For web requests, use session cookies
    session = await getServerSession(authOptions);
  }

  // 1. Check session and role
  if (!session || !session.user || session.user.role !== "employee") {
    redirect("/login");
  }
  
  // 2. Check if the employee is approved
  if (!session.user.isApproved) {
    redirect("/waiting-approval");
  }

  // 3. Fetch employee data
  const employee = await prisma.employee.findUnique({
    where: { userId: session.user.id },
    include: {
      user: true,
      assignedProduct: true,
    },
  });

  if (!employee) {
    redirect("/login");
  }

  // 4. Get locale and messages for internationalization
  const locale = await getLocale();
  const messages = await getMessages(locale);

  // 5. Render layout with providers
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <EmployeeProvider employee={employee}>
        <SidebarProvider>
    <NextIntlClientProvider locale={locale} messages={messages}>
            <EmployeeLayout>
      {children}
            </EmployeeLayout>
    </NextIntlClientProvider>
        </SidebarProvider>
      </EmployeeProvider>
    </Suspense>
  );
}
