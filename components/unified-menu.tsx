"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
// components/unified-menu.tsx
import {
  BarChart3,
  CalendarDays,
  ClipboardList,
  FileText,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  User,
  X,
  ShoppingCart,
  MapPin,  // Add this
} from "lucide-react"

import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Sheet, SheetContent, SheetClose, SheetTitle } from "@/components/ui/sheet"
import { useBreakpoint } from "@/hooks/use-responsive"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarImage, getAvatarInitials } from "@/lib/avatar-utils"

interface UnifiedMenuProps {
  userType: "admin" | "employee"
  user: any
  onLogout: () => void
}

export function UnifiedMenu({ userType, user, onLogout }: UnifiedMenuProps) {
  const [open, setOpen] = useState(false)
  const pathname = usePathname()
  const { isMobile, isTablet } = useBreakpoint()
  const [mounted, setMounted] = useState(false)

  useEffect(() => {
    setMounted(true)
  }, [])

  useEffect(() => {
    const handleToggle = () => setOpen(true)
    document.addEventListener("toggle-menu", handleToggle)
    return () => document.removeEventListener("toggle-menu", handleToggle)
  }, [])

  if (!mounted) return null

  const adminLinks = [
    { href: "/admin/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/admin/employees", label: "Employees", icon: User },
    { href: "/admin/attendance", label: "Attendance", icon: CalendarDays },
    { href: "/sales", label: "Product", icon: BarChart3 },
    { href: "/admin/sales", label: "Sales", icon: BarChart3 },
    { href: "/salaries", label: "Salaries", icon: BarChart3 },
    { href: "/admin/documents", label: "Documents", icon: FileText },
    { href: "/admin/reports", label: "Reports", icon: ClipboardList },
    { href: "/admin/location-tracking", label: "Location Tracking", icon: MapPin },
    { href: "/admin/settings", label: "Settings", icon: Settings },
  ]

  const employeeLinks = [
    { href: "/employee/dashboard", label: "Dashboard", icon: LayoutDashboard },
    { href: "/employee/profile", label: "My Profile", icon: User },
    { href: "/employee/attendance", label: "Attendance", icon: CalendarDays },
    { href: "/employee/sales", label: "Sales", icon: ShoppingCart },
    { href: "/employee/documents", label: "Documents", icon: FileText },
    { href: "/employee/location", label: "My Location", icon: MapPin },
    { href: "/employee/settings", label: "Settings", icon: Settings },
  ]

  const links = userType === "admin" ? adminLinks : employeeLinks
  const homeLink = userType === "admin" ? "/admin/dashboard" : "/employee/dashboard"
  const title = userType === "admin" ? "EMS Admin" : "EMS Portal"

  // Only show the floating menu and drawer on mobile/tablet
  if (isMobile || isTablet) {
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 right-4 z-50 h-12 w-12 rounded-full shadow-lg md:bottom-6 md:right-6"
          onClick={() => setOpen(true)}
          aria-label="Open navigation menu"
        >
          <Menu className="h-5 w-5" />
        </Button>
        <Sheet open={open} onOpenChange={setOpen}>
          <SheetContent side="left" className="flex w-72 flex-col p-0 focus:outline-none">
            <SheetTitle className="sr-only">{title}</SheetTitle>
            <div className="flex h-14 items-center justify-between border-b px-4">
              <div className="flex items-center gap-2">
                <svg
                  xmlns="http://www.w3.org/2000/svg"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  className="h-6 w-6"
                >
                  <path d="M15 6v12a3 3 0 1 0 3-3H6a3 3 0 1 0 3 3V6a3 3 0 1 0-3 3h12a3 3 0 1 0-3-3" />
                </svg>
                <span className="text-lg font-bold">{title}</span>
              </div>
              <Button variant="ghost" size="icon" onClick={() => setOpen(false)} aria-label="Close navigation menu">
                <X className="h-5 w-5" />
              </Button>
            </div>
            <div className="flex-1 overflow-y-auto">
              <nav className="grid gap-1 p-4 pt-0">
                <Link
                  href={homeLink}
                  className="flex items-center gap-2 py-2 text-lg font-semibold"
                  onClick={() => setOpen(false)}
                >
                  <Home className="h-5 w-5" />
                  <span>Home</span>
                </Link>
                <div className="my-2 h-px bg-border" />
                {links.map((link) => {
                  const isActive = pathname === link.href
                  const Icon = link.icon
                  return (
                    <Link
                      key={link.href}
                      href={link.href}
                      onClick={() => setOpen(false)}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-base transition-colors",
                        isActive ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                      )}
                    >
                      <Icon className="h-5 w-5 flex-shrink-0" />
                      <span>{link.label}</span>
                    </Link>
                  )
                })}
              </nav>
            </div>
            <div className="border-t p-4">
              <div className="flex items-center gap-2">
                <Avatar>
                  <AvatarImage 
                    src={getAvatarImage({ 
                      image: user?.image, 
                      pictureUrl: user?.employee?.pictureUrl 
                    })} 
                    alt={user?.name} 
                  />
                  <AvatarFallback>{getAvatarInitials(user?.name)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col">
                  <span className="text-sm font-medium">{user?.name}</span>
                  <span className="text-xs text-muted-foreground">{user?.email}</span>
                </div>
                <Button variant="ghost" size="icon" className="ml-auto" onClick={onLogout}>
                  <LogOut className="h-4 w-4" />
                  <span className="sr-only">Log out</span>
                </Button>
              </div>
            </div>
          </SheetContent>
        </Sheet>
      </>
    )
  }
  // On desktop, render nothing (sidebar/top menu is handled elsewhere)
  return null;
}
