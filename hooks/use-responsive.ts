"use client"

import { useEffect, useState } from "react"

export type Breakpoint = "xs" | "sm" | "md" | "lg" | "xl" | "2xl"

const breakpointValues = {
  xs: 0,
  sm: 640,
  md: 768,
  lg: 1024,
  xl: 1280,
  "2xl": 1536,
}

export function useBreakpoint() {
  const [breakpoint, setBreakpoint] = useState<Breakpoint>("xs")
  const [width, setWidth] = useState<number>(0)

  useEffect(() => {
    // Set initial width
    setWidth(window.innerWidth)

    // Determine initial breakpoint
    const determineBreakpoint = () => {
      const width = window.innerWidth
      if (width >= breakpointValues["2xl"]) return "2xl"
      if (width >= breakpointValues.xl) return "xl"
      if (width >= breakpointValues.lg) return "lg"
      if (width >= breakpointValues.md) return "md"
      if (width >= breakpointValues.sm) return "sm"
      return "xs"
    }

    setBreakpoint(determineBreakpoint())

    // Add resize listener
    const handleResize = () => {
      setWidth(window.innerWidth)
      setBreakpoint(determineBreakpoint())
    }

    window.addEventListener("resize", handleResize)
    return () => window.removeEventListener("resize", handleResize)
  }, [])

  return {
    breakpoint,
    width,
    isMobile: breakpoint === "xs" || breakpoint === "sm",
    isTablet: breakpoint === "md" || breakpoint === "lg",
    isTabletOnly: breakpoint === "md",
    isDesktop: breakpoint === "xl" || breakpoint === "2xl",
    isLargerThan: (size: Breakpoint) => width >= breakpointValues[size],
    isSmallerThan: (size: Breakpoint) => width < breakpointValues[size],
    isExactly: (size: Breakpoint) => breakpoint === size,
    isInRange: (minSize: Breakpoint, maxSize: Breakpoint) =>
      width >= breakpointValues[minSize] && width < breakpointValues[maxSize],
  }
}

export function useOrientation() {
  const [orientation, setOrientation] = useState<"portrait" | "landscape">("portrait")

  useEffect(() => {
    const handleOrientationChange = () => {
      setOrientation(window.matchMedia("(orientation: portrait)").matches ? "portrait" : "landscape")
    }

    // Set initial orientation
    handleOrientationChange()

    // Add orientation change listener
    window.addEventListener("orientationchange", handleOrientationChange)
    window.addEventListener("resize", handleOrientationChange)

    return () => {
      window.removeEventListener("orientationchange", handleOrientationChange)
      window.removeEventListener("resize", handleOrientationChange)
    }
  }, [])

  return {
    orientation,
    isPortrait: orientation === "portrait",
    isLandscape: orientation === "landscape",
  }
}

export function useTouchDevice() {
  const [isTouch, setIsTouch] = useState(false)

  useEffect(() => {
    setIsTouch("ontouchstart" in window || navigator.maxTouchPoints > 0 || (navigator as any).msMaxTouchPoints > 0)
  }, [])

  return isTouch
}
