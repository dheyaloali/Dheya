import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"

import { ResetPasswordForm } from "@/components/auth/reset-password-form"

export const metadata: Metadata = {
  title: "Reset Password | Employee Management System",
  description: "Reset your password for the Employee Management System",
}

export default function ResetPasswordPage({ params }: { params: { token: string } }) {
  return (
    <div className="container relative flex h-screen flex-col items-center justify-center md:grid lg:max-w-none lg:grid-cols-2 lg:px-0">
      <div className="relative hidden h-full flex-col bg-muted p-10 text-white lg:flex dark:border-r">
        <div className="absolute inset-0 bg-zinc-900">
          <Image
            src="/images/login-background.png"
            fill
            alt="Authentication background"
            className="object-cover opacity-20"
          />
        </div>
        <div className="relative z-20 flex items-center text-lg font-medium">
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
          Employee Management System
        </div>
        <div className="relative z-20 mt-auto">
          <blockquote className="space-y-2">
            <p className="text-lg">
              "This platform has streamlined our entire employee management process, from onboarding to performance
              tracking."
            </p>
            <footer className="text-sm">Sofia Davis, HR Director</footer>
          </blockquote>
        </div>
      </div>
      <div className="lg:p-8">
        <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[400px]">
          <div className="flex flex-col space-y-2 text-center">
            <h1 className="text-2xl font-semibold tracking-tight">Reset Password</h1>
            <p className="text-sm text-muted-foreground">Enter your new password</p>
          </div>
          <ResetPasswordForm token={params.token} />
          <p className="px-8 text-center text-sm text-muted-foreground">
            Remember your password?{" "}
            <Link href="/login" className="underline underline-offset-4 hover:text-primary">
              Back to login
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
