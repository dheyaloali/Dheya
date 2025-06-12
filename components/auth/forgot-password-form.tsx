"use client"

import { useState, useCallback, useEffect } from "react"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import * as z from "zod"
import Link from "next/link"
import { useTranslations } from "next-intl"
import ReCAPTCHA from "react-google-recaptcha"
import { debounce } from "lodash"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { requestPasswordReset } from "@/lib/auth"

// Form schema for forgot password
const formSchema = z.object({
  email: z.string().email("Please enter a valid email address"),
})

export function ForgotPasswordForm() {
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [resetLink, setResetLink] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [recaptchaToken, setRecaptchaToken] = useState("")
  const [isSubmitting, setIsSubmitting] = useState(false)
  const t = useTranslations('Auth')

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      email: "",
    },
  })

  // Debounced submit handler
  const debouncedSubmit = useCallback(
    debounce(async (values: z.infer<typeof formSchema>) => {
    setIsLoading(true)
    setError(null)
    setResetLink(null)

    try {
        const res = await fetch("/api/auth/forgot-password", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            email: values.email,
            recaptchaToken,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(t(data.message || 'unexpectedError'))
          return
        }

        setResetLink(data.resetLink)
      toast({
          title: t('resetLinkSent'),
          description: t('checkEmail'),
      })
    } catch (error) {
        setError(t('unexpectedError'))
    } finally {
      setIsLoading(false)
        setIsSubmitting(false)
      }
    }, 1000, { leading: true, trailing: false }),
    [recaptchaToken, t, toast]
  );

  async function onSubmit(values: z.infer<typeof formSchema>) {
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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="email"
          render={({ field }) => {
            const emailValue = field.value || "";
            const isEmailFormatValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(emailValue);
            return (
            <FormItem>
              <FormLabel>{t('email')}</FormLabel>
              <FormControl>
                <Input placeholder={t('enterEmail')} {...field} />
              </FormControl>
                {!isEmailFormatValid && emailValue && (
                  <span className="block text-xs mt-1 text-red-500">{t('validEmail')}</span>
                )}
              <FormMessage />
            </FormItem>
            )}}
        />
        <div className="flex justify-center">
          <ReCAPTCHA
            sitekey={process.env.NEXT_PUBLIC_RECAPTCHA_SITE_KEY || ""}
            onChange={token => setRecaptchaToken(token || "")}
        />
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        {resetLink && (
          <Alert>
            <AlertDescription className="break-all">
              <p className="mb-2">{t('resetLinkShown')}</p>
              <Link href={resetLink} className="text-primary underline">
                {resetLink}
              </Link>
            </AlertDescription>
          </Alert>
        )}

        <Button 
          type="submit" 
          className="w-full relative" 
          disabled={isLoading || isSubmitting}
        >
          {isLoading || isSubmitting ? (
            <>
              <span className="opacity-0">{t('sendResetLink')}</span>
              <span className="absolute inset-0 flex items-center justify-center">
                <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
              </span>
            </>
          ) : (
            t('sendResetLink')
          )}
        </Button>
      </form>
    </Form>
  )
}
