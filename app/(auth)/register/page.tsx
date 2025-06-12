import type { Metadata } from "next"
import Image from "next/image"
import Link from "next/link"
import { getTranslations } from 'next-intl/server'

import { RegisterForm } from "@/components/auth/register-form"
import { AuthHeadings } from "@/components/auth/AuthHeadings"
import { AuthNavLink } from "@/components/auth/AuthNavLink"

export const metadata: Metadata = {
  title: "Register | Employee Management System",
  description: "Register for the Employee Management System",
}

export default async function RegisterPage() {
  const t = await getTranslations('Auth')
  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between lg:w-1/3 bg-muted p-10 text-white dark:border-r relative">
        <div className="absolute inset-0 bg-zinc-900">
          <Image
            src="/images/register-background.png"
            fill
            alt="Authentication background"
            className="object-cover opacity-20"
          />
        </div>
        <div className="relative z-20 flex items-center text-lg font-medium mt-8">
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
        <div className="relative z-20 mt-auto mb-8">
          <blockquote className="space-y-2">
            <p className="text-lg">
              "Join our team and experience a seamless onboarding process with our integrated management system."
            </p>
            <footer className="text-sm">Michael Chen, CEO</footer>
          </blockquote>
        </div>
      </div>
      {/* Right panel (form) */}
      <div className="flex flex-1 items-center justify-center w-full lg:w-2/3 min-h-screen bg-background overflow-auto">
        <div className="w-full max-w-2xl px-6 py-10 md:px-16 md:py-16 rounded-lg shadow-sm bg-white">
          <div className="flex flex-col space-y-2 text-center mb-6">
            <AuthHeadings type="register" />
          </div>
          <RegisterForm />
          <AuthNavLink type="register" />
        </div>
      </div>
    </div>
  )
}
