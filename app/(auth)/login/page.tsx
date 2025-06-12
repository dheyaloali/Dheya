import type { Metadata } from "next"
import Link from "next/link"
import { getTranslations } from 'next-intl/server'

import LoginForm from "@/components/auth/login-form"
import { Card, CardContent, CardFooter } from "@/components/ui/card"
import { AuthHeadings } from "@/components/auth/AuthHeadings"
import { AuthNavLink } from "@/components/auth/AuthNavLink"

export const metadata: Metadata = {
  title: "Login",
  description: "Login to your account",
}

export default async function LoginPage() {
  const t = await getTranslations('Auth')
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col items-center justify-center lg:w-1/3 bg-muted p-10 text-white dark:border-r relative">
        <div className="absolute inset-0 bg-zinc-900" />
        <div className="relative z-20 flex flex-col items-center text-lg font-medium">
          <svg
            xmlns="http://www.w3.org/2000/svg"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
            className="mr-2 h-6 w-6"
          >
            <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
          </svg>
          <span>Employee Management System</span>
          <blockquote className="space-y-2 mt-8 text-center">
            <p className="text-lg">
              &ldquo;This system has streamlined our HR processes and improved employee engagement across the
              board.&rdquo;
            </p>
            <footer className="text-sm">Sofia Davis</footer>
          </blockquote>
        </div>
      </div>
      {/* Right panel (form) */}
      <div className="flex flex-col justify-center items-center w-full lg:w-2/3 min-h-screen p-8 bg-background">
        <div className="w-full max-w-md">
          <div className="flex flex-col space-y-2 text-center mb-6">
            <AuthHeadings type="login" />
          </div>
          <Card>
            <CardContent className="pt-6">
              <LoginForm />
            </CardContent>
            <CardFooter className="flex flex-col">
              <AuthNavLink type="login" />
            </CardFooter>
          </Card>
        </div>
      </div>
    </div>
  )
}
