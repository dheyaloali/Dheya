"use client"

import { useState } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar"
import { getAvatarImage, getAvatarInitials } from "@/lib/avatar-utils"
import {
  Home,
  MapPin,
  FileText,
  Settings,
  Menu,
  X,
  User,
  BarChart3,
  ShoppingCart,
  DollarSign,
  FolderOpen
} from "lucide-react"

interface EmployeeTrackingLayoutProps {
  children: React.ReactNode
  user?: any // Accept user data as prop
}

const navigation = [
  { icon: <Home className="w-5 h-5" />, label: "Dashboard", href: "/employee/dashboard" },
  { icon: <MapPin className="w-5 h-5" />, label: "Real-time Tracking", href: "/tracking" },
  { icon: <FileText className="w-5 h-5" />, label: "Attendance", href: "/employee/attendance" },
  { icon: <ShoppingCart className="w-5 h-5" />, label: "Sales", href: "/employee/sales" },
  { icon: <FolderOpen className="w-5 h-5" />, label: "Documents", href: "/employee/documents" },
  { icon: <DollarSign className="w-5 h-5" />, label: "Salary", href: "/employee/salary" },
  { icon: <BarChart3 className="w-5 h-5" />, label: "Reports", href: "/employee/reports" },
  { icon: <User className="w-5 h-5" />, label: "Profile", href: "/employee/profile" },
  { icon: <Settings className="w-5 h-5" />, label: "Settings", href: "/employee/settings" },
]

export function EmployeeTrackingLayout({ children, user }: EmployeeTrackingLayoutProps) {
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const pathname = usePathname()

  return (
    <div className="flex h-screen bg-gray-100">
      {/* Mobile sidebar overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black bg-opacity-50 lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Sidebar */}
      <div
        className={cn(
          "fixed inset-y-0 left-0 z-50 w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out lg:translate-x-0 lg:static lg:inset-0",
          sidebarOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="flex flex-col h-full">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b">
            <h1 className="text-xl font-bold text-gray-800">Employee Tracker</h1>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(false)}
              className="lg:hidden"
            >
              <X className="w-5 h-5" />
            </Button>
          </div>

          {/* User Profile */}
          <div className="p-4 border-b">
            <div className="flex items-center gap-2">
              <Avatar>
                <AvatarImage 
                  src={getAvatarImage({ 
                    image: user?.image, 
                    pictureUrl: user?.employee?.pictureUrl 
                  })} 
                  alt={user?.name || "User"} 
                />
                <AvatarFallback>
                  {getAvatarInitials(user?.name || "User")}
                </AvatarFallback>
              </Avatar>
              <div>
                <div className="font-medium">{user?.name || "Loading..."}</div>
                <div className="text-sm text-gray-500">{user?.email || "loading@example.com"}</div>
              </div>
            </div>
          </div>

          {/* Navigation */}
          <nav className="flex-1 p-4 space-y-2 overflow-y-auto">
            {navigation.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                className={cn(
                  "flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors",
                  pathname === item.href
                    ? "bg-blue-100 text-blue-700"
                    : "text-gray-700 hover:bg-gray-100"
                )}
                onClick={() => setSidebarOpen(false)}
              >
                {item.icon}
                {item.label}
              </Link>
            ))}
          </nav>

          {/* Footer */}
          <div className="p-4 border-t">
            <div className="text-xs text-gray-500 text-center">
              Native App v1.0
            </div>
          </div>
        </div>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col overflow-hidden">
        {/* Top bar */}
        <header className="bg-white shadow-sm border-b px-4 py-3">
          <div className="flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setSidebarOpen(true)}
              className="lg:hidden"
            >
              <Menu className="w-5 h-5" />
            </Button>
            
            <div className="flex items-center gap-4">
              <div className="text-sm text-gray-600">
                {user?.name || "Loading..."}
              </div>
              <Avatar className="h-8 w-8">
                <AvatarImage 
                  src={getAvatarImage({ 
                    image: user?.image, 
                    pictureUrl: user?.employee?.pictureUrl 
                  })} 
                  alt={user?.name || "User"} 
                />
                <AvatarFallback>
                  {getAvatarInitials(user?.name || "User")}
                </AvatarFallback>
              </Avatar>
            </div>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-auto">
          {children}
        </main>
      </div>
    </div>
  )
}