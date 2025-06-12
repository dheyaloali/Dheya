// Performance monitoring utilities

// Store navigation timing data
interface NavigationTiming {
  route: string
  startTime: number
  endTime: number
  duration: number
}

const navigationTimings: NavigationTiming[] = []

// Track page navigation start
export function startNavigationTiming(route: string): number {
  const startTime = performance.now()
  return startTime
}

// Track page navigation end and calculate duration
export function endNavigationTiming(route: string, startTime: number): NavigationTiming {
  const endTime = performance.now()
  const duration = endTime - startTime

  const timing = {
    route,
    startTime,
    endTime,
    duration,
  }

  navigationTimings.push(timing)

  // Log performance data
  console.log(`Navigation to ${route} took ${duration.toFixed(2)}ms`)

  return timing
}

// Get all navigation timings
export function getNavigationTimings(): NavigationTiming[] {
  return navigationTimings
}

// Clear all navigation timings
export function clearNavigationTimings(): void {
  navigationTimings.length = 0
}

// Track component render time
export function trackRenderTime(componentName: string, callback: () => void): void {
  const startTime = performance.now()
  callback()
  const endTime = performance.now()
  console.log(`Rendering ${componentName} took ${(endTime - startTime).toFixed(2)}ms`)
}

// Measure function execution time
export function measureExecutionTime<T>(fn: () => T, label: string): T {
  const startTime = performance.now()
  const result = fn()
  const endTime = performance.now()
  console.log(`${label} took ${(endTime - startTime).toFixed(2)}ms`)
  return result
}
