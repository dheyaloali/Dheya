"use client"

import type React from "react"

import Link from "next/link"
import { usePathname } from "next/navigation"

import { cn } from "@/lib/utils"

export function MainNav({ className, ...props }: React.HTMLAttributes<HTMLElement>) {
  const pathname = usePathname()

  const routes = [
    {
      href: "/admin/dashboard",
      label: "Dashboard",
      active: pathname === "/admin/dashboard",
    },
    {
      href: "/admin/employees",
      label: "Employees",
      active: pathname === "/admin/employees",
    },
    {
      href: "/admin/attendance",
      label: "Attendance",
      active: pathname === "/admin/attendance",
    },
    {
      href: "/sales",
      label: "Product",
      active: pathname === "/sales",
    },
    {
      href: "/admin/sales",
      label: "Sales",
      active: pathname === "/admin/sales",
    },
    {
      href: "/salaries",
      label: "Salaries",
      active: pathname === "/salaries",
    },
    {
      href: "/admin/reports",
      label: "Reports",
      active: pathname === "/admin/reports",
    },
    {
      href: "/admin/documents",
      label: "Documents",
      active: pathname === "/admin/documents",
    },
    {
      href: "/admin/settings",
      label: "Settings",
      active: pathname === "/admin/settings",
    },
  ]

  return (
    <nav className={cn("flex items-center space-x-4 lg:space-x-6", className)} {...props}>
      {routes.map((route) => (
        <Link
          key={route.href}
          href={route.href}
          className={cn(
            "text-sm font-medium transition-colors hover:text-primary",
            route.active ? "text-primary" : "text-muted-foreground",
          )}
        >
          {route.label}
        </Link>
      ))}
    </nav>
  )
}
