"use client"

import type React from "react"

import { useEffect, useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useBreakpoint } from "@/hooks/use-responsive"

interface NavigationItem {
  href: string
  label: string
  icon: React.ComponentType<{ className?: string }>
}

interface ResponsiveNavigationProps {
  items: NavigationItem[]
  orientation?: "horizontal" | "vertical"
  className?: string
}

export function ResponsiveNavigation({ items, orientation = "horizontal", className }: ResponsiveNavigationProps) {
  const pathname = usePathname()
  const { breakpoint } = useBreakpoint()
  const [mounted, setMounted] = useState(false)

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Determine how many items to show based on screen size
  const getVisibleItems = () => {
    switch (breakpoint) {
      case "xs":
        return items.slice(0, 2) // Show only 2 items on mobile
      case "sm":
        return items.slice(0, 3) // Show 3 items on small screens
      case "md":
        return items.slice(0, 5) // Show 5 items on medium screens
      default:
        return items // Show all items on large screens
    }
  }

  const visibleItems = getVisibleItems()
  const hasMoreItems = visibleItems.length < items.length

  return (
    <nav className={cn("flex items-center gap-2", orientation === "vertical" && "flex-col items-start", className)}>
      {visibleItems.map((item) => {
        const isActive = pathname === item.href
        const Icon = item.icon

        return (
          <Link
            key={item.href}
            href={item.href}
            className={cn(
              "flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground"
                : "hover:bg-muted text-muted-foreground hover:text-foreground",
              orientation === "vertical" && "w-full",
            )}
          >
            <Icon className={cn("h-4 w-4", breakpoint === "xs" && "h-5 w-5")} />
            <span className={cn(breakpoint === "xs" && orientation === "horizontal" && "sr-only", "truncate")}>
              {item.label}
            </span>
          </Link>
        )
      })}

      {hasMoreItems && (
        <div className="relative">
          {/* More menu implementation would go here */}
          <button className="flex items-center gap-2 rounded-md px-3 py-2 text-sm font-medium hover:bg-muted">
            <span>More</span>
          </button>
        </div>
      )}
    </nav>
  )
}
