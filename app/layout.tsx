import type React from "react"
import type { Metadata, Viewport } from "next"
import { Inter } from "next/font/google"
import { Providers } from "@/components/providers"
import "./globals.css"
import 'leaflet/dist/leaflet.css'
import 'leaflet.markercluster/dist/MarkerCluster.css'
import 'leaflet.markercluster/dist/MarkerCluster.Default.css'
import { LocaleProvider } from './_components/LocaleProvider'

const inter = Inter({ subsets: ["latin"] })

export const metadata: Metadata = {
  title: "Employee Management System",
  description: "A comprehensive employee management system",
  generator: "v0.dev",
}

// Add viewport configuration at the root level
export const viewport: Viewport = {
  themeColor: "#3b82f6",
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className={inter.className}>
        <LocaleProvider>
          <Providers>{children}</Providers>
        </LocaleProvider>
      </body>
    </html>
  )
}
