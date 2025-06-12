import useSWR from 'swr'

const fetcher = (url: string) => fetch(url).then(res => res.json())

export function useEmployeeSettings() {
  const { data, error, isLoading, mutate } = useSWR('/api/employee/settings', fetcher)

  // Update settings (PUT)
  const updateSettings = async (updates: Partial<{ language: string }>) => {
    if (!data) return
    // Optimistic update
    mutate({ ...data, ...updates }, false)
    const res = await fetch('/api/employee/settings', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...data, ...updates }),
    })
    if (!res.ok) {
      // Rollback on error
      mutate()
      throw new Error('Failed to update settings')
    }
    mutate() // Revalidate
  }

  return { data, error, isLoading, updateSettings, mutate }
} 