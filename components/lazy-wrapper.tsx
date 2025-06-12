"use client"

import { Suspense, lazy, type ComponentType, type ReactNode } from "react"
import { Skeleton } from "@/components/ui/skeleton"

interface LazyWrapperProps {
  component: () => Promise<{ default: ComponentType<any> }>
  fallback?: ReactNode
  props?: Record<string, any>
}

export function LazyWrapper({ component, fallback, props = {} }: LazyWrapperProps) {
  const LazyComponent = lazy(component)

  return (
    <Suspense fallback={fallback || <DefaultFallback />}>
      <LazyComponent {...props} />
    </Suspense>
  )
}

function DefaultFallback() {
  return (
    <div className="w-full space-y-4">
      <Skeleton className="h-8 w-48" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-3/4" />
    </div>
  )
}
