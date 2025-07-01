"use client"

import { useState, useEffect, useCallback, Suspense } from "react"
import { useRouter, useSearchParams } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import Link from "next/link"
import { signIn, signOut } from "next-auth/react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import ReCAPTCHA from "react-google-recaptcha"
import debounce from "lodash.debounce"
import { Capacitor } from '@capacitor/core';
import { Preferences } from '@capacitor/preferences';

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"

// Flag to prevent multiple logout attempts
let logoutHandled = false;

// Move schema into a function that takes t
function getLoginFormSchema(t: (key: string) => string) {
  return z.object({
  email: z.string().email({
      message: t('validEmail'),
  }),
  password: z.string().min(4, {
      message: t('passwordMin4'),
  }),
  mfaCode: z.string().optional(),
})
}

// Helper function to clear cookies on client side
function clearAuthCookies() {
  const cookies = document.cookie.split(';');
  
  for (let i = 0; i < cookies.length; i++) {
    const cookie = cookies[i];
    const eqPos = cookie.indexOf('=');
    const name = eqPos > -1 ? cookie.substr(0, eqPos).trim() : cookie.trim();
    
    // Clear all next-auth related cookies
    if (name.startsWith('next-auth.')) {
      document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; path=/;`;
    }
  }
}

// Wrapper component that doesn't use useSearchParams
export function LoginForm() {
  return (
    <Suspense fallback={<div className="w-full p-4 text-center">Loading login form...</div>}>
      <LoginFormContent />
    </Suspense>
  );
}

// Main component that uses useSearchParams
function LoginFormContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [showMfa, setShowMfa] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [recaptchaToken, setRecaptchaToken] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  // Store credentials for MFA step
  const [storedCredentials, setStoredCredentials] = useState<{email: string, password: string} | null>(null)
  const t = useTranslations('Auth')

  // Check for session_expired error and clear cookies if needed
  useEffect(() => {
    const error = searchParams.get('error')
    const noLoop = searchParams.get('noLoop')
    const cleared = searchParams.get('cleared')
    
    // Skip if already cleared or no error
    if (cleared === 'true' || !error) {
      return;
    }
    
    // Only handle session expiration once to prevent loops
    // And only if there was an actual previous session
    if (error === 'session_expired' && !logoutHandled) {
      // Check if there are any next-auth cookies present
      const hasSessionCookies = document.cookie.split(';').some(cookie => 
        cookie.trim().startsWith('next-auth.')
      );
      
      // Only proceed with logout if we actually had a session
      if (hasSessionCookies) {
      logoutHandled = true;
      
      // Clear cookies client-side
      clearAuthCookies();
      
      // Force signOut to clear any NextAuth internal state
      signOut({ redirect: false }).then(() => {
        // If this is not already a noLoop request, make one to the force-logout endpoint
        // with noRedirect=true to ensure cookies are cleared server-side without redirecting
        if (noLoop !== 'true') {
          fetch('/api/auth/force-logout?noRedirect=true')
            .then(() => {
              // Replace URL without the error parameter to prevent loops
              const newUrl = new URL(window.location.href);
              newUrl.searchParams.delete('error');
              newUrl.searchParams.set('cleared', 'true');
              window.history.replaceState({}, '', newUrl.toString());
            })
            .catch(console.error);
        } else {
          // Just remove the error parameter from URL
          const newUrl = new URL(window.location.href);
          newUrl.searchParams.delete('error');
          newUrl.searchParams.set('cleared', 'true');
          window.history.replaceState({}, '', newUrl.toString());
        }
      });
      } else {
        // No actual session cookies, just clean up the URL
        const newUrl = new URL(window.location.href);
        newUrl.searchParams.delete('error');
        window.history.replaceState({}, '', newUrl.toString());
      }
    }
  }, [searchParams]);

  const form = useForm<z.infer<ReturnType<typeof getLoginFormSchema>>>({
    resolver: zodResolver(getLoginFormSchema(t)),
    defaultValues: {
      email: "",
      password: "",
      mfaCode: "",
    },
  })

  // Clear error when MFA code changes or is emptied
  useEffect(() => {
    if (!form.watch("mfaCode") && loginError) {
    setLoginError("");
  }
  }, [form.watch("mfaCode")]);

  // Reset recaptcha when switching to MFA mode
  useEffect(() => {
    if (showMfa) {
      // No need to reset recaptcha here, as we'll use the stored credentials
    }
  }, [showMfa]);

  // Debounced submit handler
  const debouncedSubmit = useCallback(
    debounce(async (values: z.infer<ReturnType<typeof getLoginFormSchema>>) => {
      // If we're showing MFA, we don't need to check recaptcha again
      if (!showMfa && !recaptchaToken) {
        setLoginError(t('recaptchaRequired'))
        setIsSubmitting(false)
        return
      }
      
      setIsLoading(true)
      setLoginError("")
      
      try {
        // If we're in MFA mode, use the stored credentials + MFA code
        const credentials = showMfa ? {
          redirect: false,
          email: storedCredentials?.email || '',
          password: storedCredentials?.password || '',
          mfaCode: values.mfaCode,
          // Skip reCAPTCHA validation for MFA verification step
          // This is causing the "Invalid reCAPTCHA" error
        } : {
          redirect: false,
          email: values.email,
          password: values.password,
          recaptchaToken,
        };
        
        const res = await signIn("credentials", credentials);
        
        if (res?.error) {
          if (res.error.includes("MFA code is required")) {
            // Store credentials for the MFA step
            setStoredCredentials({
              email: values.email,
              password: values.password
            });
            setShowMfa(true)
            setIsLoading(false)
            setIsSubmitting(false)
            return
          } else if (res.error.includes("Invalid MFA code")) {
            // Keep the stored credentials and just show the error
            setShowMfa(true)
            setLoginError(t('invalidMfa'))
            console.log("Invalid MFA code, keeping stored credentials:", storedCredentials)
          } else if (res.error.includes("Admin MFA required")) {
            // Handle admin MFA requirement
            setStoredCredentials({
              email: values.email,
              password: values.password
            });
            setShowMfa(true)
            setIsLoading(false)
            setIsSubmitting(false)
            return
          } else if (res.error.includes("EmailNotVerified")) {
            // Redirect to email verification page
            router.push("/verify-email/pending");
            return;
          } else {
            // If we get here with an error but we're in MFA mode, it might be
            // that the stored credentials are no longer valid
            if (showMfa) {
              console.error("Error during MFA verification with stored credentials:", res.error);
              console.log("Stored credentials might be invalid:", storedCredentials);
            }
            setLoginError(t('invalidEmailOrPassword'))
          }
          setIsLoading(false)
          setIsSubmitting(false)
          return
        }
        
        // Check for the user object in the response to determine role
        // This is a custom addition to the default next-auth response
        // Note: this requires modifying the `jwt` callback in `lib/auth.ts`
        // to pass the user object through.
        if (res && !res.error) {
        toast({
          title: t('loginSuccess'),
          description: t('welcome', { name: values.email.split("@")[0] }),
        })

          // Manually fetch the session to get the user's role and JWT
          const sessionRes = await fetch('/api/auth/session');
          const session = await sessionRes.json();
          console.log('Session after login:', session); // Debug log to see session data
          
          // --- Native: Store JWT in Preferences ---
          if (typeof window !== 'undefined' && Capacitor.isNativePlatform()) {
            try {
              // Get the raw JWT token from our endpoint
              const jwtResponse = await fetch('/api/auth/get-jwt');
              if (jwtResponse.ok) {
                const jwtData = await jwtResponse.json();
                if (jwtData.token) {
                  await Preferences.set({ key: 'jwt', value: jwtData.token });
                  console.log('[Native] Stored JWT in Preferences:', jwtData.token.substring(0, 20) + '...');
                } else {
                  console.warn('[Native] No JWT token returned from get-jwt endpoint');
                }
              } else {
                console.warn('[Native] Failed to get JWT token:', jwtResponse.status);
              }
            } catch (error) {
              console.error('[Native] Error getting JWT token:', error);
            }
          }
          
          // Admin redirection - use isAdmin flag if role is missing
          if (session?.user?.role === 'admin' || session?.user?.isAdmin === true) {
            // Check if admin needs to set up MFA
            if (session?.user?.mfaEnabled === false) {
              console.log('Admin needs MFA setup, redirecting to /setup-mfa');
              router.replace("/setup-mfa");
            } else {
              router.replace("/admin/dashboard");
            }
          } else if (session?.user?.role === 'employee') {
            // Check if employee is approved
            if (session?.user?.isApproved === false) {
              console.log('Employee not approved, redirecting to waiting-approval');
              router.replace("/waiting-approval");
            } else {
              router.replace("/employee/dashboard");
            }
          } else {
            // Fallback to home page if role is not defined
            router.replace("/");
          }
        } else {
          // Fallback for cases where the response is not as expected
          setLoginError(t('invalidEmailOrPassword'))
          setIsLoading(false)
          setIsSubmitting(false)
        }
      } catch (error) {
        console.error("Login error:", error)
        toast({
          variant: "destructive",
          title: t('loginFailed'),
          description: t('unexpectedError'),
        })
        setIsLoading(false)
        setIsSubmitting(false)
      }
    }, 1000, { leading: true, trailing: false }),
    [recaptchaToken, showMfa, storedCredentials, t, toast, router]
  );

  async function onSubmit(values: z.infer<ReturnType<typeof getLoginFormSchema>>) {
    if (isSubmitting) return
    setIsSubmitting(true)
    await debouncedSubmit(values)
  }

  // Cleanup debounce on unmount
  useEffect(() => {
    return () => {
      debouncedSubmit.cancel()
    }
  }, [debouncedSubmit])

  return (
    <div className="w-full">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
          {!showMfa && (
            <>
              <FormField
                control={form.control}
                name="email"
                render={({ field }: { field: any }) => {
                  const emailValue = field.value || "";
                  const isEmailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
                  return (
                  <FormItem>
                    <FormLabel>{t('email')}</FormLabel>
                    <FormControl>
                        <Input placeholder={t('enterEmail')} {...field} className="w-full px-3 py-2"
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) => {
                            field.onChange(e);
                          }}
                        />
                    </FormControl>
                      {!isEmailFormatValid && emailValue && (
                        <span className="block text-xs mt-1 text-red-500">{t('validEmail')}</span>
                      )}
                    <FormMessage />
                  </FormItem>
                  )}}
              />
              <FormField
                control={form.control}
                name="password"
                render={({ field }: { field: any }) => (
                  <FormItem>
                    <FormLabel>{t('password')}</FormLabel>
                    <FormControl>
                      <div className="relative">
                        <Input type={showPassword ? "text" : "password"} placeholder={t('enterPassword')} {...field} className="w-full px-3 py-2 pr-10" />
                        <button type="button" onClick={() => setShowPassword(v => !v)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 text-gray-400 hover:text-primary focus:outline-none"
                          tabIndex={-1}
                        >
                          {showPassword ? "🙈" : "👁️"}
                        </button>
                      </div>
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <div className="flex justify-center">
                <ReCAPTCHA
                  sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
                  onChange={token => setRecaptchaToken(token || "")}
                />
              </div>
            </>
          )}
          
          {showMfa && (
            <FormField
              control={form.control}
              name="mfaCode"
              render={({ field }: { field: any }) => (
                <FormItem>
                  <FormLabel>{t('mfaCode')}</FormLabel>
                  <FormControl>
                    <Input
                      placeholder={t('enterMfaCode')}
                      {...field}
                      className="w-full px-3 py-2"
                      autoFocus
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
          )}
          
          {showMfa && !form.watch("mfaCode") && !loginError && (
            <div className="mb-2 rounded bg-blue-50 px-3 py-2 text-sm text-blue-700 border border-blue-200">
              {t('enterMfaToContinue')}
            </div>
          )}
          
          {loginError && loginError !== t('mfaRequired') && (
            <p className="text-sm font-medium text-red-500">{loginError}</p>
          )}
          
          {!showMfa && (
            <div className="text-right">
              <Link href="/forgot-password" className="text-sm text-primary hover:underline">
                {t('forgotPassword')}
              </Link>
            </div>
          )}
          
          <Button 
            type="submit" 
            className="w-full relative" 
            disabled={isLoading || isSubmitting || (!showMfa && !recaptchaToken)}
          >
            {isLoading || isSubmitting ? (
              <>
                <span className="opacity-0">{showMfa ? t('verify') : t('login')}</span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </span>
              </>
            ) : (
              showMfa ? t('verify') : t('login')
            )}
          </Button>
          
          {showMfa && (
            <button
              type="button"
              onClick={() => {
                setShowMfa(false);
                setLoginError("");
                form.setValue("mfaCode", "");
                setStoredCredentials(null);
              }}
              className="w-full text-center text-sm text-gray-500 hover:text-gray-700 mt-2"
            >
              {t('backToLogin')}
            </button>
          )}
        </form>
      </Form>
    </div>
  )
}

// Add default export as well to ensure compatibility
export default LoginForm
