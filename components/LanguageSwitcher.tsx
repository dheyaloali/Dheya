"use client"

import { useState } from "react"
import { motion, AnimatePresence } from "framer-motion"
import { Globe } from "lucide-react"
import { cn } from "@/lib/utils"

type Language = {
  code: string
  name: string
  nativeName: string
  flag: string
  dir: "ltr" | "rtl"
}

const languages: Language[] = [
  {
    code: "en",
    name: "English",
    nativeName: "English",
    flag: "🇺🇸",
    dir: "ltr",
  },
  {
    code: "id",
    name: "Indonesian",
    nativeName: "Bahasa Indonesia",
    flag: "🇮🇩",
    dir: "ltr",
  },
]

export function LanguageSwitcher({
  minimal = false,
  value,
  onChange,
}: {
  minimal?: boolean,
  value?: string,
  onChange?: (lang: string) => Promise<any> | void,
}) {
  const [isExpanded, setIsExpanded] = useState(false)
  const [loading, setLoading] = useState(false)

  const currentLang = languages.find(l => l.code === value) || languages[0]

  const handleSelect = async (lang: Language) => {
    if (loading) return // Prevent multiple requests
    setLoading(true)
    if (onChange) {
      try {
        await Promise.resolve(onChange(lang.code))
        document.cookie = `locale=${lang.code}; path=/`
        window.location.reload()
      } catch {
        // error handled by parent
      } finally {
        setLoading(false)
      }
    } else {
      setLoading(false)
    }
    setIsExpanded(false)
  }

  if (minimal) {
  return (
          <div className="relative">
        <button
          onClick={() => !loading && setIsExpanded((v) => !v)}
          className="flex items-center justify-center w-9 h-9 bg-muted rounded-full border border-input text-primary hover:bg-accent focus:outline-none"
          type="button"
          disabled={loading}
            >
          <Globe className="w-4 h-4" />
        </button>
            <AnimatePresence>
              {isExpanded && (
                <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              className="absolute right-0 mt-2 z-10 bg-white border rounded shadow-lg min-w-[120px]"
                >
              {languages.map((lang) => (
                <button
                      key={lang.code}
                  onClick={() => handleSelect(lang)}
                      className={cn(
                    "flex items-center w-full px-3 py-2 text-sm hover:bg-accent gap-2",
                    currentLang.code === lang.code ? "font-semibold text-primary" : "text-muted-foreground"
                      )}
                  type="button"
                  disabled={loading}
                    >
                  <span>{lang.flag}</span>
                  <span>{lang.nativeName}</span>
                </button>
                  ))}
                </motion.div>
              )}
            </AnimatePresence>
    </div>
  )
  }

  // If not minimal, render nothing
  return null;
}
