"use client"

import { useEffect, useState } from "react"
import { usePathname } from "next/navigation"

export function RouteTransition() {
  const pathname = usePathname()
  const [isTransitioning, setIsTransitioning] = useState(false)

  useEffect(() => {
    // Start transition
    setIsTransitioning(true)

    // End transition after a short delay
    const timer = setTimeout(() => {
      setIsTransitioning(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [pathname])

  if (!isTransitioning) return null

  return (
    <div className="fixed top-0 left-0 right-0 z-50 h-1 bg-primary">
      <div className="h-full w-1/3 animate-progress-indeterminate bg-primary-foreground"></div>
    </div>
  )
}
