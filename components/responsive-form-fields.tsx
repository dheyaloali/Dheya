"use client"

import type React from "react"

import { forwardRef } from "react"

import { cn } from "@/lib/utils"
import { FormControl, FormDescription, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { useBreakpoint } from "@/hooks/use-responsive"

interface ResponsiveFormFieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  name: string
  label: string
  description?: string
  form: any // Using any for simplicity, ideally would be properly typed
  className?: string
  containerClassName?: string
}

export const ResponsiveFormField = forwardRef<HTMLInputElement, ResponsiveFormFieldProps>(
  ({ name, label, description, form, className, containerClassName, ...props }, ref) => {
    const { isMobile } = useBreakpoint()

    return (
      <FormField
        control={form.control}
        name={name}
        render={({ field }) => (
          <FormItem
            className={cn(isMobile ? "flex flex-col" : "grid grid-cols-12 items-center gap-4", containerClassName)}
          >
            <FormLabel className={isMobile ? "" : "col-span-3"}>{label}</FormLabel>
            <div className={isMobile ? "w-full" : "col-span-9 w-full"}>
              <FormControl>
                <Input
                  className={cn(
                    isMobile && "h-12 text-base", // Larger on mobile for touch
                    className,
                  )}
                  {...field}
                  {...props}
                  ref={ref}
                />
              </FormControl>
              {description && (
                <FormDescription className={isMobile ? "text-xs" : "text-sm"}>{description}</FormDescription>
              )}
              <FormMessage />
            </div>
          </FormItem>
        )}
      />
    )
  },
)
ResponsiveFormField.displayName = "ResponsiveFormField"
