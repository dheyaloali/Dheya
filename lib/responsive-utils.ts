import { cn } from "@/lib/utils"

type FontSize = "xs" | "sm" | "base" | "lg" | "xl" | "2xl" | "3xl" | "4xl" | "5xl" | "6xl"

interface ResponsiveTextProps {
  base: FontSize
  sm?: FontSize
  md?: FontSize
  lg?: FontSize
  xl?: FontSize
  "2xl"?: FontSize
}

export function responsiveText({ base, sm, md, lg, xl, "2xl": xxl }: ResponsiveTextProps): string {
  return cn(
    `text-${base}`,
    sm && `sm:text-${sm}`,
    md && `md:text-${md}`,
    lg && `lg:text-${lg}`,
    xl && `xl:text-${xl}`,
    xxl && `2xl:text-${xxl}`,
  )
}

export function responsiveSpacing(
  baseSpacing: number,
  options?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
    "2xl"?: number
    type?: "p" | "m" | "px" | "py" | "mx" | "my"
  },
): string {
  const { sm, md, lg, xl, "2xl": xxl, type = "p" } = options || {}

  return cn(
    `${type}-${baseSpacing}`,
    sm !== undefined && `sm:${type}-${sm}`,
    md !== undefined && `md:${type}-${md}`,
    lg !== undefined && `lg:${type}-${lg}`,
    xl !== undefined && `xl:${type}-${xl}`,
    xxl !== undefined && `2xl:${type}-${xxl}`,
  )
}

export function responsiveGrid(
  baseCols: number,
  options?: {
    sm?: number
    md?: number
    lg?: number
    xl?: number
    "2xl"?: number
    gap?: number
  },
): string {
  const { sm, md, lg, xl, "2xl": xxl, gap = 4 } = options || {}

  return cn(
    "grid",
    `grid-cols-${baseCols}`,
    `gap-${gap}`,
    sm !== undefined && `sm:grid-cols-${sm}`,
    md !== undefined && `md:grid-cols-${md}`,
    lg !== undefined && `lg:grid-cols-${lg}`,
    xl !== undefined && `xl:grid-cols-${xl}`,
    xxl !== undefined && `2xl:grid-cols-${xxl}`,
  )
}
