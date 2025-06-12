"use client"

import { LanguageSwitcher } from "@/components/LanguageSwitcher"

export function AuthLanguageSwitcher({ value }: { value: string }) {
  return (
    <LanguageSwitcher
      minimal
      value={value}
      onChange={async (lang: string) => {
        document.cookie = `locale=${lang}; path=/`
        window.location.reload()
      }}
    />
  )
} 