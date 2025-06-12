import type { Metadata } from "next"

import { SettingsContent } from "@/components/admin/settings-content"

export const metadata: Metadata = {
  title: "Settings | Employee Management System",
  description: "Configure system settings for the Employee Management System",
}

export default function SettingsPage() {
  return (
      <SettingsContent />
  )
}
