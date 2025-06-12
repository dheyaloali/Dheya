"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { BarChart3, ClipboardList, FileText, Home, Menu, Package, User } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { useSidebar } from "./sidebar-provider"

const navItems = [
  { name: "Dashboard", href: "/", icon: Home },
  { name: "Attendance", href: "/attendance", icon: ClipboardList },
  { name: "Sales", href: "/sales", icon: BarChart3 },
  { name: "Products", href: "/products", icon: Package },
  { name: "Documents", href: "/documents", icon: FileText },
  { name: "My Profile", href: "/profile", icon: User },
]

export function Sidebar() {
  const { isOpen, toggle, isMobile } = useSidebar()
  const pathname = usePathname()

  return (
    <>
      {/* Mobile overlay */}
      {isMobile && isOpen && <div className="fixed inset-0 z-20 bg-black/50" onClick={toggle} />}

      {/* Sidebar */}
      <aside
        className={cn(
          "h-screen flex flex-col border-r bg-background transition-all duration-300 z-30",
          isOpen ? "w-64" : "w-16",
          isMobile && !isOpen && "w-0",
          isMobile ? "fixed" : "sticky top-0",
        )}
      >
        <div className="flex h-14 items-center border-b px-3">
          {isOpen ? (
            <h1 className="text-lg font-semibold">Business EMS</h1>
          ) : (
            <span className="mx-auto">
              <User className="h-6 w-6" />
            </span>
          )}
          <Button variant="ghost" size="icon" className="ml-auto md:hidden" onClick={toggle}>
            <Menu className="h-5 w-5" />
          </Button>
        </div>

        <nav className="flex-1 overflow-auto p-2">
          <ul className="space-y-1">
            {navItems.map((item) => (
              <li key={item.name}>
                <Link
                  href={item.href}
                  className={cn(
                    "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                    pathname === item.href ? "bg-primary text-primary-foreground" : "hover:bg-muted",
                  )}
                >
                  <item.icon className="h-5 w-5" />
                  {isOpen && <span>{item.name}</span>}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="border-t p-3">
          <div className={cn("flex items-center gap-3 rounded-md", isOpen ? "justify-start" : "justify-center")}>
            <div className="h-8 w-8 rounded-full bg-muted flex items-center justify-center">
              <User className="h-4 w-4" />
            </div>
            {isOpen && (
              <div className="overflow-hidden">
                <p className="text-sm font-medium truncate">Sarah Johnson</p>
                <p className="text-xs text-muted-foreground truncate">sarah.johnson@company.com</p>
              </div>
            )}
          </div>
        </div>
      </aside>

      {/* Toggle button for desktop */}
      <Button
        variant="outline"
        size="icon"
        className={cn("fixed bottom-4 left-4 z-40 rounded-full shadow-md hidden lg:flex", isOpen && "left-60")}
        onClick={toggle}
      >
        <Menu className="h-4 w-4" />
      </Button>

      {/* Mobile toggle button */}
      <Button
        variant="outline"
        size="icon"
        className={cn("fixed top-3 left-3 z-40 rounded-full shadow-md md:hidden", isOpen && "hidden")}
        onClick={toggle}
      >
        <Menu className="h-4 w-4" />
      </Button>
    </>
  )
}
