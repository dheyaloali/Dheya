// Data fetching utilities with caching

interface CacheEntry<T> {
  data: T
  timestamp: number
}

// Cache storage
const cache: Record<string, CacheEntry<any>> = {}

// Cache expiration time (5 minutes)
const CACHE_EXPIRATION = 5 * 60 * 1000

// Fetch data with caching
export async function fetchWithCache<T>(
  key: string,
  fetchFn: () => Promise<T>,
  options: {
    forceRefresh?: boolean
    expiration?: number
  } = {},
): Promise<T> {
  const { forceRefresh = false, expiration = CACHE_EXPIRATION } = options

  // Check if we have a valid cache entry
  const entry = cache[key]
  const now = Date.now()

  if (!forceRefresh && entry && now - entry.timestamp < expiration) {
    console.log(`Cache hit for ${key}`)
    return entry.data
  }

  // Fetch fresh data
  console.log(`Cache miss for ${key}, fetching fresh data`)
  const startTime = performance.now()
  const data = await fetchFn()
  const endTime = performance.now()

  console.log(`Fetching ${key} took ${(endTime - startTime).toFixed(2)}ms`)

  // Update cache
  cache[key] = {
    data,
    timestamp: now,
  }

  return data
}

// Clear specific cache entry
export function clearCacheEntry(key: string): void {
  delete cache[key]
}

// Clear all cache
export function clearCache(): void {
  Object.keys(cache).forEach((key) => {
    delete cache[key]
  })
}

// Prefetch data
export async function prefetchData<T>(key: string, fetchFn: () => Promise<T>): Promise<void> {
  try {
    await fetchWithCache(key, fetchFn)
    console.log(`Prefetched data for ${key}`)
  } catch (error) {
    console.error(`Error prefetching data for ${key}:`, error)
  }
}
