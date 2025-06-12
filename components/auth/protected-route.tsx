"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { isAuthenticated, getCurrentUser } from "@/lib/session-manager"
import { useToast } from "@/components/ui/use-toast"
import { useTranslations } from "next-intl"

interface ProtectedRouteProps {
  children: React.ReactNode
  requireAdmin?: boolean
}

export function ProtectedRoute({ children, requireAdmin = false }: ProtectedRouteProps) {
  const router = useRouter()
  const { toast } = useToast()
  const [isAuthorized, setIsAuthorized] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const t = useTranslations('Auth')

  useEffect(() => {
    const checkAuth = () => {
      if (!isAuthenticated()) {
        router.replace("/login")
        return
      }

      const user = getCurrentUser()

      if (!user) {
        router.replace("/login")
        return
      }

      if (requireAdmin && !user.isAdmin) {
        toast({
          variant: "destructive",
          title: t('accessDenied'),
          description: t('noPermission'),
        })
        router.replace("/employee/dashboard")
        return
      }

      if (!requireAdmin && user.isAdmin) {
        router.replace("/admin/dashboard")
        return
      }

      setIsAuthorized(true)
      setIsLoading(false)
    }

    checkAuth()
  }, [router, toast, requireAdmin, t])

  if (isLoading) {
    return (
      <div className="flex h-screen w-full items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-primary border-t-transparent"></div>
      </div>
    )
  }

  return isAuthorized ? <>{children}</> : null
}
