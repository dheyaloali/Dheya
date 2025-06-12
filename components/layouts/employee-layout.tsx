"use client"

import { useState, useEffect, ReactNode, useCallback } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter, usePathname } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import Link from "next/link"
import { Menu, User, ClipboardList, BarChart3, Package, FileText, Bell } from "lucide-react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { useTranslations } from "next-intl"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import { useRef } from "react"
import NotificationPanel from "@/components/ui/NotificationPanel"

export function EmployeeLayout({ children }: { children: ReactNode }) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(true)
  const [isMobile, setIsMobile] = useState(false)
  const [showLogoutDialog, setShowLogoutDialog] = useState(false)
  const t = useTranslations('Dashboard')
  const tProfile = useTranslations('Profile')
  const [drawerOpen, setDrawerOpen] = useState(false)
  // For badge: simulate unread notifications
  const unreadCount = 2 // Replace with real logic later

  // Responsive detection
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < 768;
      setIsMobile(mobile);
      setIsOpen(!mobile); // Open sidebar on desktop, close on mobile
    };
    checkMobile();
    window.addEventListener("resize", checkMobile);
    return () => window.removeEventListener("resize", checkMobile);
  }, []);

  const toggle = useCallback(() => {
    setIsOpen((prev) => !prev)
  }, [])

  const handleLogout = () => {
    setShowLogoutDialog(true)
  }
  const confirmLogout = () => {
    setShowLogoutDialog(false)
    signOut({ callbackUrl: "/login" })
  }
  const cancelLogout = () => {
    setShowLogoutDialog(false)
  }

  // Sidebar content (same as before)
  const SidebarContent = (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && (
        <div className="fixed inset-0 z-40 bg-black/50" onClick={toggle} />
      )}
      {/* Sidebar */}
      <aside
        className={
          `h-screen flex flex-col border-r bg-background transition-all duration-300 z-50 ` +
          (isMobile
            ? isOpen
              ? "fixed left-0 top-0 w-64 shadow-lg"
              : "fixed left-0 top-0 w-0 opacity-0 pointer-events-none"
            : isOpen
              ? "sticky top-0 w-64"
              : "sticky top-0 w-16"
          )
        }
      >
        <div className="flex h-14 items-center border-b px-3 gap-2">
          <Menu className="h-6 w-6 text-blue-700" />
          {isOpen && <span className="text-lg font-bold text-blue-700 tracking-tight">{t('menu')}</span>}
          <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={toggle}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>
        <nav className="flex-1 overflow-auto p-2">
          <ul className="space-y-1">
            {[
              { name: t('dashboard'), href: "/employee/dashboard", icon: BarChart3 },
              { name: t('attendance'), href: "/employee/attendance", icon: ClipboardList },
              { name: t('sales'), href: "/employee/sales", icon: BarChart3 },
              { name: t('products'), href: "/employee/product", icon: Package },
              { name: t('documents'), href: "/employee/documents", icon: FileText },
              { name: t('reports'), href: "/employee/reports", icon: ClipboardList },
              { name: t('salaries'), href: "/employee/salary", icon: BarChart3 },
              { name: tProfile('myProfile'), href: "/employee/profile", icon: User },
            ].map((item) => {
              const isActive = pathname === item.href
              return (
                <li key={item.href}>
                  <Link
                    href={item.href}
                    className={`flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors
                      ${isActive ? "bg-blue-100 text-blue-700 font-semibold border-l-4 border-blue-600" : "hover:bg-blue-50 hover:text-blue-700"}
                    `}
                  >
                    <item.icon className={`h-5 w-5 ${isActive ? "text-blue-700" : "text-muted-foreground"}`} />
                    {isOpen && <span>{item.name}</span>}
                  </Link>
                </li>
              )
            })}
          </ul>
        </nav>
        <div className="border-t p-3">
          <div className={"flex items-center gap-3 rounded-md" + (isOpen ? " justify-start" : " justify-center") }>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">{session?.user?.name || tProfile('myProfile')}</p>
                <p className="text-xs text-muted-foreground truncate">{session?.user?.email || ""}</p>
              </div>
            )}
          </div>
        </div>
        <div className="mt-auto px-2 py-4">
          <Button
            onClick={handleLogout}
            className="w-full h-12 text-base font-semibold rounded-lg"
            size="default"
          >
            {t('logout')}
          </Button>
        </div>
        <Dialog open={showLogoutDialog} onOpenChange={setShowLogoutDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>{t('confirmLogout')}</DialogTitle>
            </DialogHeader>
            <p>{t('areYouSureLogout')}</p>
            <DialogFooter>
              <Button variant="outline" onClick={cancelLogout}>{t('cancel')}</Button>
              <Button variant="destructive" onClick={confirmLogout}>{t('logout')}</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </aside>
      {/* Toggle button for desktop */}
      {!isMobile && !isOpen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed bottom-4 left-4 z-40 rounded-full shadow-md hidden lg:flex"
          onClick={toggle}
        >
          <Menu className="h-4 w-4" />
        </Button>
      )}
      {/* Mobile toggle button */}
      {isMobile && !isOpen && (
        <Button
          variant="outline"
          size="icon"
          className="fixed top-3 left-3 z-50 rounded-full shadow-md md:hidden"
          onClick={toggle}
        >
          <Menu className="h-4 w-4" />
              </Button>
      )}
    </>
  )

  return (
    <div className="flex min-h-screen w-full bg-muted/10">
      {/* Sidebar (fixed on desktop, drawer on mobile) */}
      {SidebarContent}
      {/* Notification Panel (modern, floating, right edge) */}
      <NotificationPanel />
      {/* Main content area (with left margin for sidebar on desktop and open) */}
      <main
        className="flex-1 min-w-0 pb-8 pt-4 transition-all duration-300"
      >
        {children}
      </main>
    </div>
  )
}
