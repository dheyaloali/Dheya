"use client";

import { useState, useEffect, useRef, Suspense } from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import Image from "next/image";
import { useTranslations } from "next-intl";
import { useReCaptcha } from "@/hooks/useReCaptcha";
import { motion } from "framer-motion";
import ReCAPTCHA from "react-google-recaptcha";
import { Download } from "lucide-react";

import { LoginForm } from "@/components/auth/login-form";
import { AuthHeadings } from "@/components/auth/AuthHeadings";
import { AuthNavLink } from "@/components/auth/AuthNavLink";

// Main page component without useSearchParams
export default function LoginPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen">Loading...</div>}>
      <LoginPageContent />
    </Suspense>
  );
}

// Inner component that uses useSearchParams
import { useSearchParams } from "next/navigation";

function LoginPageContent() {
  const t = useTranslations("Auth");
  const router = useRouter();
  const searchParams = useSearchParams();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [mfaCode, setMfaCode] = useState("");
  const [showMfaInput, setShowMfaInput] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { executeReCaptcha } = useReCaptcha();
  const [recaptchaToken, setRecaptchaToken] = useState("");
  const recaptchaRef = useRef<ReCAPTCHA>(null);

  // Store credentials for MFA step
  const [storedCredentials, setStoredCredentials] = useState<{email: string, password: string} | null>(null);

  // Check for callbackUrl or error in URL
  useEffect(() => {
    const errorParam = searchParams?.get("error");
    if (errorParam) {
      if (errorParam === "CredentialsSignin") {
        setError(t("invalidCredentials"));
      } else if (errorParam === "EmailNotVerified") {
        setError(t("emailNotVerified"));
        // Redirect to verification pending page
        router.push("/verify-email/pending");
      } else {
        setError(t("loginError"));
      }
    }
  }, [searchParams, t, router]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setIsLoading(true);

    try {
      // For initial login (not MFA step)
      if (!showMfaInput) {
        // Store credentials for MFA step
        setStoredCredentials({
          email,
          password
        });

        // Use visible reCAPTCHA token
        if (!recaptchaToken) {
          setError(t("recaptchaRequired"));
          setIsLoading(false);
          return;
        }

        const result = await signIn("credentials", {
          redirect: false,
          email,
          password,
          recaptchaToken,
        });

        if (result?.error) {
          // Handle MFA requirement
          if (result.error === "MFA code is required for admin login") {
            setShowMfaInput(true);
            setError(null);
            // Reset reCAPTCHA for MFA step
            setRecaptchaToken("");
            if (recaptchaRef.current) {
              recaptchaRef.current.reset();
            }
          } 
          // Handle email verification error
          else if (result.error === "EmailNotVerified") {
            router.push("/verify-email/pending");
          } 
          else {
            setError(
              result.error === "CredentialsSignin"
                ? t("invalidCredentials")
                : result.error
            );
          }
        } else {
          // Success - redirect to appropriate dashboard
          const callbackUrl = searchParams?.get("callbackUrl");
          router.push(callbackUrl || "/");
          router.refresh();
        }
      } 
      // For MFA step
      else {
        // Get fresh reCAPTCHA token for MFA step
        let mfaRecaptchaToken = recaptchaToken;
        if (!mfaRecaptchaToken && executeReCaptcha) {
          mfaRecaptchaToken = await executeReCaptcha("login_mfa");
        }

        if (!mfaRecaptchaToken) {
          setError(t("recaptchaRequired"));
          setIsLoading(false);
          return;
        }

        if (!storedCredentials) {
          setError(t("sessionExpired"));
          setIsLoading(false);
          setShowMfaInput(false);
          return;
        }

        const result = await signIn("credentials", {
          redirect: false,
          email: storedCredentials.email,
          password: storedCredentials.password,
          mfaCode,
          recaptchaToken: mfaRecaptchaToken,
        });

        if (result?.error) {
          setError(
            result.error.includes("Invalid MFA")
              ? t("invalidMfa")
              : result.error
          );
        } else {
          // Success - redirect to appropriate dashboard
          const callbackUrl = searchParams?.get("callbackUrl");
          router.push(callbackUrl || "/");
          router.refresh();
        }
      }
    } catch (err) {
      setError(t("loginError"));
      console.error("Login error:", err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex flex-col lg:flex-row">
      {/* Left panel */}
      <div className="hidden lg:flex flex-col justify-between lg:w-1/3 bg-muted p-10 text-white dark:border-r relative">
        <div className="absolute inset-0 bg-zinc-900">
          <Image
            src="/images/login-background.png"
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
              "Our employee management system has transformed how we handle HR processes and team coordination."
            </p>
            <footer className="text-sm">Sarah Johnson, HR Director</footer>
          </blockquote>
        </div>
      </div>
      {/* Right panel (form) */}
      <div className="flex flex-1 items-center justify-center w-full lg:w-2/3 min-h-screen bg-background overflow-auto">
        <div className="w-full max-w-md px-6 py-10 md:px-16 md:py-16 rounded-lg shadow-sm bg-white">
          <div className="flex flex-col space-y-2 text-center mb-6">
            <AuthHeadings type="login" />
          </div>
          
              <LoginForm />
              <AuthNavLink type="login" />
        </div>
      </div>
    </div>
  );
}
