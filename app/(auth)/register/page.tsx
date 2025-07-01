"use client";

import { useState } from "react";
import Image from "next/image"
import Link from "next/link"
import { useTranslations } from "next-intl"
import { Loader2, CheckCircle2, AlertCircle, Info } from "lucide-react"

import { RegisterForm } from "@/components/auth/register-form"
import { AuthHeadings } from "@/components/auth/AuthHeadings"
import { AuthNavLink } from "@/components/auth/AuthNavLink"

// Metadata is moved to a separate file: metadata.ts in the same directory

export default function RegisterPage() {
  const t = useTranslations('Auth')

  return (
    <div className="grid lg:grid-cols-3 h-screen">
      <div className="relative hidden lg:block lg:col-span-1">
        <Image
          src="/images/register-background.png"
          alt="Register"
          fill
          className="object-cover"
        />
        <div className="absolute inset-0 bg-black/50" />
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="space-y-4 text-center">
            <h1 className="text-4xl font-bold text-white">
              {t("welcomeBack")}
            </h1>
            <p className="text-white/80">
              {t("registerSubtitle")}
            </p>
          </div>
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center w-full lg:col-span-2 min-h-screen bg-background overflow-auto">
        <div className="w-full px-6 py-10 md:px-16 md:py-16 rounded-lg shadow-sm bg-white mt-10">
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
