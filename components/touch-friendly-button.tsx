"use client"

import type React from "react"

import { forwardRef } from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"
import { useTouchDevice } from "@/hooks/use-responsive"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground hover:bg-primary/90",
        destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
        outline: "border border-input bg-background hover:bg-accent hover:text-accent-foreground",
        secondary: "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-10 px-4 py-2",
        sm: "h-9 rounded-md px-3",
        lg: "h-11 rounded-md px-8",
        icon: "h-10 w-10",
        // Touch-friendly sizes
        "touch-default": "h-12 px-5 py-3",
        "touch-sm": "h-10 rounded-md px-4 py-2",
        "touch-lg": "h-14 rounded-md px-10 py-4",
        "touch-icon": "h-12 w-12",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
)

export interface TouchFriendlyButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const TouchFriendlyButton = forwardRef<HTMLButtonElement, TouchFriendlyButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const isTouch = useTouchDevice()

    // Adjust size for touch devices
    let touchSize = size
    if (isTouch) {
      if (size === "default") touchSize = "touch-default"
      else if (size === "sm") touchSize = "touch-sm"
      else if (size === "lg") touchSize = "touch-lg"
      else if (size === "icon") touchSize = "touch-icon"
    }

    const Comp = asChild ? Slot : "button"

    return <Comp className={cn(buttonVariants({ variant, size: touchSize, className }))} ref={ref} {...props} />
  },
)
TouchFriendlyButton.displayName = "TouchFriendlyButton"

export { TouchFriendlyButton, buttonVariants }
