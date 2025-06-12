"use client"
import { usePathname } from "next/navigation"
import { useState, useEffect } from "react"
import { useSession, signOut } from "next-auth/react"
import { useRouter } from "next/navigation"
import {
  Menu, Users, CalendarDays, BarChart3, FileText, ClipboardList, Settings, LogOut, ShoppingCart, MapPin, Bell
} from "lucide-react"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import React from "react"
import Link from "next/link"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import { useToast } from "@/components/ui/use-toast"
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover"
import NotificationPanel from "@/components/ui/NotificationPanel"
import { AdminSocketProvider } from "@/components/admin/AdminSocketProvider"

const menuItems = [
  { label: "Dashboard", href: "/admin/dashboard", icon: <BarChart3 className="w-5 h-5" /> },
  { label: "Employees", href: "/admin/employees", icon: <Users className="w-5 h-5" /> },
  { label: "Attendance", href: "/admin/attendance", icon: <CalendarDays className="w-5 h-5" /> },
  { label: "Product", href: "/admin/products", icon: <ShoppingCart className="w-5 h-5" /> },
  { label: "Sales", href: "/admin/sales", icon: <BarChart3 className="w-6 h-6" /> },
  { label: "Salaries", href: "/admin/salaries", icon: <ClipboardList className="w-5 h-5" /> },
  { label: "Documents", href: "/admin/documents", icon: <FileText className="w-5 h-5" /> },
  { label: "Reports", href: "/admin/reports", icon: <ClipboardList className="w-5 h-5" /> },
  { label: "Location Tracking", href: "/admin/location-tracking", icon: <MapPin className="w-5 h-5" /> },
  { label: "Settings", href: "/admin/settings", icon: <Settings className="w-5 h-5" /> },
]

interface AdminLayoutProps {
  children: React.ReactNode;
}

export function AdminLayout({ children }: AdminLayoutProps) {
  const { data: session, status } = useSession()
  const router = useRouter()
  const [drawerOpen, setDrawerOpen] = useState(false)
  const pathname = usePathname()
  const [showLogoutConfirmation, setShowLogoutConfirmation] = useState(false)
  const { toast } = useToast();

  useEffect(() => {
    if (status === "authenticated" && (!session?.user || !(session.user as any)?.isAdmin)) {
      router.replace("/login")
    }
  }, [session, status, router, pathname])

  if (status === "loading") {
    return <div className="flex h-screen w-full items-center justify-center">Loading...</div>
  }

  if (status === "authenticated" && (!session?.user || !(session.user as any)?.isAdmin)) {
    return null
  }

  const user = session?.user as { name?: string | null; email?: string | null; image?: string | null; isAdmin?: boolean } | undefined;

  const initiateLogout = () => setShowLogoutConfirmation(true)
  const confirmLogout = () => {
    signOut({ callbackUrl: "/login" })
    setShowLogoutConfirmation(false)
  }
  const cancelLogout = () => setShowLogoutConfirmation(false)

  // Sidebar content (used in both desktop and mobile drawer)
  const SidebarContent = (
    <div className="flex flex-col h-full">
      {/* Logo/Title */}
      <div className="flex items-center gap-2 px-6 mt-8 mb-10">
        <BarChart3 className="h-7 w-7 text-blue-700" />
        <span className="text-2xl font-extrabold text-blue-700 tracking-tight">EMS Admin</span>
      </div>
      {/* User Info */}
      <div className="flex items-center gap-3 px-6 py-2 mb-4">
        <Avatar className="h-10 w-10">
          <AvatarImage src="/placeholder-user.png" alt={user?.name ?? "User"} />
          <AvatarFallback>{user?.name?.split(" ").map(n => n[0]).join("") ?? "U"}</AvatarFallback>
        </Avatar>
        <div>
          <div className="font-semibold">{user?.name ?? "User"}</div>
          <div className="text-xs text-gray-500">{user?.email ?? ""}</div>
        </div>
      </div>
      <div className="border-b mb-2" />
      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto max-h-screen px-2 py-2 flex flex-col scrollbar-thin scrollbar-thumb-gray-300 scrollbar-track-gray-100">
          <div className="flex flex-col gap-1">
            {menuItems.map(item => {
              const isActive = pathname === item.href
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-3 px-4 py-3 rounded-lg text-base font-medium transition-all
                    ${isActive ? "bg-blue-100 text-blue-700" : "text-gray-700 hover:bg-blue-50 hover:text-blue-700"}
                    focus:outline-none focus:ring-2 focus:ring-blue-200`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </Link>
              )
            })}
          </div>
          <div className="mt-auto px-2 py-4">
            <Button variant="outline" className="w-full flex gap-2" onClick={initiateLogout}>
              <LogOut className="w-5 h-5" /> Logout
            </Button>
            <AlertDialog open={showLogoutConfirmation} onOpenChange={setShowLogoutConfirmation}>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Confirm Logout</AlertDialogTitle>
                  <AlertDialogDescription>
                    Are you sure you want to log out? Any unsaved changes will be lost.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel onClick={cancelLogout}>Cancel</AlertDialogCancel>
                  <AlertDialogAction onClick={confirmLogout}>Logout</AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </div>
        </nav>
    </div>
  )

  return (
    <div className="flex min-h-screen w-full bg-muted/10">
      {/* Sidebar (fixed on desktop, drawer on mobile) */}
      <aside
        className="hidden md:flex fixed left-0 top-0 h-screen w-64 bg-white border-r shadow-sm flex-col z-30"
        style={{
          // Ensures the sidebar is always visible and independent
          minHeight: '100vh',
          maxHeight: '100vh',
        }}
      >
        {SidebarContent}
      </aside>
      {/* Mobile menu button */}
      <button
        className="md:hidden fixed top-4 left-4 z-40 bg-white border rounded-full p-2 shadow-md"
        onClick={() => setDrawerOpen(true)}
        aria-label="Open menu"
      >
        <Menu className="w-6 h-6 text-blue-700" />
      </button>
      {/* Mobile Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent side="left" className="p-0 w-64">
          <SheetTitle className="sr-only">Admin Navigation</SheetTitle>
          {SidebarContent}
        </SheetContent>
      </Sheet>
      {/* Notification Panel (modern, floating, right edge) */}
      <NotificationPanel />
      {/* Main content area (with left margin for sidebar on desktop and open) */}
      <main
        className="flex-1 min-w-0 pb-8 pt-4 transition-all duration-300 md:ml-64"
      >
        <AdminSocketProvider>
          {children}
        </AdminSocketProvider>
      </main>
    </div>
  )
}
