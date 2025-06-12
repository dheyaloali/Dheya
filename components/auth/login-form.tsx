"use client"

import { useState, useEffect, useCallback } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import Link from "next/link"
import { signIn } from "next-auth/react"
import { useSession } from "next-auth/react"
import { useTranslations } from "next-intl"
import ReCAPTCHA from "react-google-recaptcha"
import debounce from "lodash.debounce"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useToast } from "@/components/ui/use-toast"

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

// Make sure to export the component as default AND named export
export function LoginForm() {
  const router = useRouter()
  const { toast } = useToast()
  const { data: session, status } = useSession()
  const [isLoading, setIsLoading] = useState(false)
  const [loginError, setLoginError] = useState("")
  const [showMfa, setShowMfa] = useState(false)
  const [showPassword, setShowPassword] = useState(false)
  const [recaptchaToken, setRecaptchaToken] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const t = useTranslations('Auth')

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

  // Debounced submit handler
  const debouncedSubmit = useCallback(
    debounce(async (values: z.infer<ReturnType<typeof getLoginFormSchema>>) => {
      if (!recaptchaToken) {
        setLoginError(t('recaptchaRequired'))
        setIsSubmitting(false)
        return
      }
    setIsLoading(true)
    setLoginError("")
    try {
      const res = await signIn("credentials", {
        redirect: false,
        email: values.email,
        password: values.password,
        mfaCode: showMfa ? values.mfaCode : undefined,
          recaptchaToken,
      })
      if (res?.error) {
        if (res.error.includes("MFA code is required")) {
          setShowMfa(true)
          setIsLoading(false)
            setIsSubmitting(false)
          return
        } else if (res.error.includes("Invalid MFA code")) {
          setShowMfa(true)
          setLoginError(t('invalidMfa'))
        } else {
          setLoginError(t('invalidEmailOrPassword'))
        }
        setIsLoading(false)
          setIsSubmitting(false)
        return
      }
      toast({
        title: t('loginSuccess'),
        description: t('welcome', { name: values.email.split("@")[0] }),
      })
      router.replace("/");
      return;
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
    [recaptchaToken, showMfa, t, toast, router]
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
          {(showMfa || loginError === t('mfaRequired')) && (
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
          <div className="flex justify-center">
            <ReCAPTCHA
              sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
              onChange={token => setRecaptchaToken(token || "")}
            />
          </div>
          <div className="text-right">
            <Link href="/forgot-password" className="text-sm text-primary hover:underline">
              {t('forgotPassword')}
            </Link>
          </div>
          <Button 
            type="submit" 
            className="w-full relative" 
            disabled={isLoading || isSubmitting}
          >
            {isLoading || isSubmitting ? (
              <>
                <span className="opacity-0">{t('login')}</span>
                <span className="absolute inset-0 flex items-center justify-center">
                  <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                </span>
              </>
            ) : (
              t('login')
            )}
          </Button>
        </form>
      </Form>
    </div>
  )
}

// Add default export as well to ensure compatibility
export default LoginForm
