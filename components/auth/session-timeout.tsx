"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { getCurrentUser, isAuthenticated, logout, updateLastActive, getSessionTimeout } from "@/lib/session-manager"
import { useTranslations } from "next-intl"

// Time before showing warning (5 minutes before timeout)
const WARNING_BEFORE = 5 * 60 * 1000

export function SessionTimeoutHandler() {
  const router = useRouter()
  const [showWarning, setShowWarning] = useState(false)
  const [timeLeft, setTimeLeft] = useState(0)
  const [intervalId, setIntervalId] = useState<NodeJS.Timeout | null>(null)
  const t = useTranslations('Auth')

  // Check session status periodically
  useEffect(() => {
    const checkSession = () => {
      if (!isAuthenticated()) {
        // Already logged out, redirect to login
        router.replace("/login")
        return
      }

      const user = getCurrentUser()
      if (!user || !user.lastActive) return

      // Get the current session timeout from localStorage (or default)
      const sessionTimeout = getSessionTimeout()

      const now = Date.now()
      const elapsed = now - user.lastActive
      const remaining = sessionTimeout - elapsed

      // If less than WARNING_BEFORE milliseconds remaining, show warning
      if (remaining <= WARNING_BEFORE) {
        setTimeLeft(Math.floor(remaining / 1000))
        setShowWarning(true)

        // Start countdown timer
        if (!intervalId) {
          const id = setInterval(() => {
            setTimeLeft((prev) => {
              if (prev <= 1) {
                // Time's up, logout
                clearInterval(id)
                logout().then(() => {
                  router.replace("/login")
                }).catch(console.error)
                return 0
              }
              return prev - 1
            })
          }, 1000)

          setIntervalId(id)
        }
      }
    }

    // Check every minute
    const id = setInterval(checkSession, 60 * 1000)

    // Initial check
    checkSession()

    return () => {
      clearInterval(id)
      if (intervalId) clearInterval(intervalId)
    }
  }, [router, intervalId])

  // Handle continue session
  const handleContinue = () => {
    updateLastActive()
    setShowWarning(false)

    if (intervalId) {
      clearInterval(intervalId)
      setIntervalId(null)
    }
  }

  return (
    <AlertDialog open={showWarning}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t('sessionTimeoutTitle')}</AlertDialogTitle>
          <AlertDialogDescription>
            {t('sessionTimeoutDesc', { minutes: Math.floor(timeLeft / 60), seconds: (timeLeft % 60).toString().padStart(2, "0") })}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogAction onClick={handleContinue}>{t('continueSession')}</AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
