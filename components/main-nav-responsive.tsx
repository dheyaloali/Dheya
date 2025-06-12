"use client"

import type React from "react"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { useBreakpoint } from "@/hooks/use-responsive"
import { Button } from "@/components/ui/button"
import { ChevronDown } from "lucide-react"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"

interface MainNavProps extends React.HTMLAttributes<HTMLElement> {
  items?: {
    href: string
    label: string
  }[]
}

export function MainNavResponsive({ className, items = [], ...props }: MainNavProps) {
  const pathname = usePathname()
  const { breakpoint, isMobile, isTablet } = useBreakpoint()
  const [mounted, setMounted] = useState(false)

  // Handle hydration mismatch
  useEffect(() => {
    setMounted(true)
  }, [])

  if (!mounted) return null

  // Default routes if none provided
  const routes =
    items.length > 0
      ? items
      : [
          {
            href: "/admin/dashboard",
            label: "Dashboard",
          },
          {
            href: "/admin/employees",
            label: "Employees",
          },
          {
            href: "/admin/attendance",
            label: "Attendance",
          },
          {
            href: "/sales",
            label: "Sales",
          },
          {
            href: "/salaries",
            label: "Salaries",
          },
          {
            href: "/admin/reports",
            label: "Reports",
          },
          {
            href: "/admin/documents",
            label: "Documents",
          },
          {
            href: "/admin/settings",
            label: "Settings",
          },
        ]

  // Determine how many items to show based on screen size
  const getVisibleItems = () => {
    if (isMobile) return routes.slice(0, 2)
    if (isTablet) return routes.slice(0, 4)
    if (breakpoint === "lg") return routes.slice(0, 6)
    return routes
  }

  const visibleItems = getVisibleItems()
  const hiddenItems = routes.slice(visibleItems.length)
  const hasMoreItems = hiddenItems.length > 0

  return (
    <nav className={cn("flex items-center space-x-2 lg:space-x-4", className)} {...props}>
      {visibleItems.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            pathname === route.href ? "text-primary" : "text-muted-foreground",
            "px-2 py-1 rounded-md hover:bg-muted/50",
          )}
        >
          {route.label}
        </Link>
      ))}

      {hasMoreItems && (
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="h-8 gap-1">
              More
              <ChevronDown className="h-4 w-4" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-40">
            {hiddenItems.map((route) => (
              <DropdownMenuItem key={route.href} asChild>
                <Link href={route.href} className={cn(pathname === route.href ? "font-medium" : "")}>
                  {route.label}
                </Link>
              </DropdownMenuItem>
            ))}
          </DropdownMenuContent>
        </DropdownMenu>
      )}
    </nav>
  )
}
