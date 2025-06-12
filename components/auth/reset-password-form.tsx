"use client"

import { useState, useEffect } from "react"
import { useRouter } from "next/navigation"
import { zodResolver } from "@hookform/resolvers/zod"
import { useForm } from "react-hook-form"
import * as z from "zod"
import { useTranslations } from "next-intl"

import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { useToast } from "@/components/ui/use-toast"
import { verifyResetToken, resetPassword } from "@/lib/auth"

// Form schema for reset password
const formSchema = z
  .object({
    password: z.string().min(6, {
      message: "Password must be at least 6 characters.",
    }),
    confirmPassword: z.string().min(6, {
      message: "Password must be at least 6 characters.",
    }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  })

export function ResetPasswordForm({ token }: { token: string }) {
  const router = useRouter()
  const { toast } = useToast()
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [isValidToken, setIsValidToken] = useState<boolean | null>(null)
  const t = useTranslations('Auth')

  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      password: "",
      confirmPassword: "",
    },
  })

  // Verify token on component mount
  useEffect(() => {
    const email = verifyResetToken(token)
    if (email) {
      setIsValidToken(true)
    } else {
      setIsValidToken(false)
      setError(t('invalidOrExpiredToken'))
    }
  }, [token, t])

  async function onSubmit(values: z.infer<typeof formSchema>) {
    if (!isValidToken) return

    setIsLoading(true)
    setError(null)

    try {
      // Reset the password
      const success = resetPassword(token, values.password)

      if (success) {
        toast({
          title: t('passwordResetSuccess'),
          description: t('passwordResetSuccessDesc'),
        })

        // Redirect to login page after a short delay
        setTimeout(() => {
          router.push("/login")
        }, 2000)
      } else {
        setError(t('failedToResetPassword'))
        toast({
          variant: "destructive",
          title: t('error'),
          description: t('failedToResetPassword'),
        })
      }
    } catch (error) {
      setError(t('unexpectedError'))
      toast({
        variant: "destructive",
        title: t('error'),
        description: t('unexpectedError'),
      })
    } finally {
      setIsLoading(false)
    }
  }

  if (isValidToken === false) {
    return (
      <Alert variant="destructive" className="mt-4">
        <AlertDescription>{t('invalidOrExpiredToken')}</AlertDescription>
      </Alert>
    )
  }

  return (
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
        <FormField
          control={form.control}
          name="password"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('newPassword')}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={t('enterPassword')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        <FormField
          control={form.control}
          name="confirmPassword"
          render={({ field }) => (
            <FormItem>
              <FormLabel>{t('confirmNewPassword')}</FormLabel>
              <FormControl>
                <Input type="password" placeholder={t('enterPassword')} {...field} />
              </FormControl>
              <FormMessage />
            </FormItem>
          )}
        />

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <Button type="submit" className="w-full" disabled={isLoading || isValidToken === false}>
          {isLoading ? t('resetting') : t('resetPassword')}
        </Button>
      </form>
    </Form>
  )
}
