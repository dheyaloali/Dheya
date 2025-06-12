"use client"

import { useEffect, useRef } from "react"
import { usePathname, useRouter } from "next/navigation"
import { prefetchData } from "@/lib/data-fetching"
import { startNavigationTiming, endNavigationTiming } from "@/lib/performance"

// List of routes to prefetch data for
const PREFETCH_ROUTES = [
  {
    path: "/admin/dashboard",
    dataSets: [
      {
        key: "dashboard-stats",
        fn: async () => {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 300))
          return {
            /* mock data */
          }
        },
      },
      {
        key: "top-performers",
        fn: async () => {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 200))
          return {
            /* mock data */
          }
        },
      },
    ],
  },
  {
    path: "/employee/dashboard",
    dataSets: [
      {
        key: "employee-stats-default-user",
        fn: async () => {
          // Simulate API call
          await new Promise((resolve) => setTimeout(resolve, 300))
          return {
            /* mock data */
          }
        },
      },
    ],
  },
]

export function NavigationOptimizer() {
  const router = useRouter()
  const pathname = usePathname()
  const navigationStartTimeRef = useRef<number | null>(null)
  const lastPathRef = useRef<string | null>(null)

  // Track navigation timing
  useEffect(() => {
    if (lastPathRef.current && lastPathRef.current !== pathname && navigationStartTimeRef.current) {
      // Navigation completed
      endNavigationTiming(pathname, navigationStartTimeRef.current)
      navigationStartTimeRef.current = null
    }

    lastPathRef.current = pathname
  }, [pathname])

  // Prefetch data for common routes
  useEffect(() => {
    // Prefetch data for routes the user is likely to visit next
    const prefetchRelatedRoutes = () => {
      const currentRoute = PREFETCH_ROUTES.find((route) => pathname.startsWith(route.path))

      if (currentRoute) {
        // Find related routes to prefetch
        const relatedRoutes = PREFETCH_ROUTES.filter(
          (route) =>
            route.path !== currentRoute.path &&
            // Admin routes are related to other admin routes
            ((pathname.includes("/admin/") && route.path.includes("/admin/")) ||
              // Employee routes are related to other employee routes
              (pathname.includes("/employee/") && route.path.includes("/employee/"))),
        )

        // Prefetch data for related routes
        relatedRoutes.forEach((route) => {
          route.dataSets.forEach((dataSet) => {
            prefetchData(dataSet.key, dataSet.fn)
          })
        })
      }
    }

    // Wait for idle time to prefetch
    if (typeof window !== "undefined" && "requestIdleCallback" in window) {
      // @ts-ignore - requestIdleCallback is not in the TypeScript types
      window.requestIdleCallback(prefetchRelatedRoutes)
    } else {
      setTimeout(prefetchRelatedRoutes, 1000)
    }
  }, [pathname])

  // Intercept navigation events
  useEffect(() => {
    // Intercept link clicks to measure navigation timing
    const handleLinkClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement
      const link = target.closest("a")

      if (link && link.href && link.href.startsWith(window.location.origin)) {
        // Start timing the navigation
        navigationStartTimeRef.current = startNavigationTiming(link.pathname)
      }
    }

    document.addEventListener("click", handleLinkClick)

    return () => {
      document.removeEventListener("click", handleLinkClick)
    }
  }, [])

  return null
}
