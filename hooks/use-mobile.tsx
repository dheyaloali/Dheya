"use client"

import * as React from "react"
import { Capacitor } from '@capacitor/core'

const MOBILE_BREAKPOINT = 768

export function useIsMobile() {
  const [isMobile, setIsMobile] = React.useState<boolean | undefined>(undefined)

  React.useEffect(() => {
    const mql = window.matchMedia(`(max-width: ${MOBILE_BREAKPOINT - 1}px)`)
    const onChange = () => {
      setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    }
    mql.addEventListener("change", onChange)
    setIsMobile(window.innerWidth < MOBILE_BREAKPOINT)
    return () => mql.removeEventListener("change", onChange)
  }, [])

  return !!isMobile
}

// Add the useMobile hook for Capacitor native detection
export function useMobile() {
  const [isNative, setIsNative] = React.useState(false)
  
  React.useEffect(() => {
    // Only run this check in the browser
    if (typeof window !== 'undefined') {
      try {
        setIsNative(Capacitor.isNativePlatform())
        console.log('Capacitor environment detected:', Capacitor.isNativePlatform())
      } catch (error) {
        console.error('Error detecting Capacitor environment:', error)
        setIsNative(false)
      }
    }
  }, [])

  return { isNative }
}
