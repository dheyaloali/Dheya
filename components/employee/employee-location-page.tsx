"use client"

import { useState, useEffect, useRef } from "react"
import { MapContainer } from "../../components/admin/map-container.tsx"
import { Button } from "../../components/ui/button.tsx"
import { Switch } from "../../components/ui/switch.tsx"
import { useToast } from "../../components/ui/use-toast.ts"
import type { Employee } from "../../lib/types.ts"
import apiClient from "../../lib/api-client.ts"
import { MapPin, Battery, Clock, AlertTriangle } from "lucide-react"
import { useTranslations } from "next-intl"

export function EmployeeLocationPage() {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTracking, setIsTracking] = useState(true)
  const { toast } = useToast()
  const t = useTranslations('Location')
  const watchIdRef = useRef<number | null>(null)
  const lastSentRef = useRef<{ lat: number; lng: number; time: number } | null>(null)

  // Fetch current employee data (keep for UI refresh, but not for location updates)
  useEffect(() => {
    const getCurrentEmployee = async () => {
      try {
        setIsLoading(true)
        const data = await apiClient.fetchCurrentEmployee()
        setEmployee(data)
        setIsTracking(data.isActive)
      } catch (error) {
        toast({
          title: t('fetchErrorTitle'),
          description: t('fetchErrorDescription'),
          variant: "destructive",
        })
      } finally {
        setIsLoading(false)
      }
    }
    getCurrentEmployee()
    // Optionally, refresh employee data every 2 minutes for UI (not for location updates)
    const intervalId = setInterval(getCurrentEmployee, 120000)
    return () => clearInterval(intervalId)
  }, [toast, t])

  // Real-time location tracking effect
  useEffect(() => {
    if (!isTracking) {
      // If tracking is off, clear any existing watcher
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
      return
    }
    // Start watching position
    watchIdRef.current = navigator.geolocation.watchPosition(
      async (pos) => {
        const { latitude, longitude } = pos.coords
        const now = Date.now()
        // Throttle: only send if moved >5m or >5s since last sent (more aggressive for real-time)
        const last = lastSentRef.current
        const dist = last
          ? Math.sqrt(
              Math.pow(latitude - last.lat, 2) + Math.pow(longitude - last.lng, 2)
            ) * 111139 // rough meters per degree
          : Infinity
        if (!last || dist > 5 || now - last.time > 5000) {
          try {
            await apiClient.updateEmployeeLocation({
              latitude,
              longitude,
              timestamp: now,
            })
            lastSentRef.current = { lat: latitude, lng: longitude, time: now }
          } catch (error) {
            toast({
              title: t('trackingErrorTitle'),
              description: t('trackingErrorDescription'),
              variant: "destructive",
            })
          }
        }
      },
      (error) => {
        toast({
          title: t('locationErrorTitle'),
          description: t('locationErrorDescription'),
          variant: "destructive",
        })
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    )
    // Cleanup on unmount or when tracking is disabled
    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current)
        watchIdRef.current = null
      }
    }
  }, [isTracking, toast, t])

  // Format the last update time
  const formatLastUpdate = (timestamp: number) => {
    const date = new Date(timestamp)
    return date.toLocaleString()
  }

  // Handle manual check-in
  const handleCheckIn = async () => {
    if (!employee) return

    try {
      setIsLoading(true)
      // Get current position
      navigator.geolocation.getCurrentPosition(
        async (position) => {
          const { latitude, longitude } = position.coords

          // Update employee location
          await apiClient.updateEmployeeLocation({
            latitude,
            longitude,
            timestamp: Date.now(),
          })

          // Refresh employee data
          const updatedEmployee = await apiClient.fetchCurrentEmployee()
          setEmployee(updatedEmployee)

          toast({
            title: t('checkInSuccessTitle'),
            description: t('checkInSuccessDescription'),
          })

          setIsLoading(false)
        },
        (error) => {
          console.error("Geolocation error:", error)
          toast({
            title: t('locationErrorTitle'),
            description: t('locationErrorDescription'),
            variant: "destructive",
          })
          setIsLoading(false)
        },
        { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 },
      )
    } catch (error) {
      toast({
        title: t('checkInFailedTitle'),
        description: t('checkInFailedDescription'),
        variant: "destructive",
      })
      setIsLoading(false)
    }
  }

  // Handle tracking toggle
  const handleTrackingToggle = async (enabled: boolean) => {
    if (!employee) return

    try {
      setIsLoading(true)
      // Update tracking status
      await apiClient.updateEmployeeLocation({
        isActive: enabled,
        timestamp: Date.now(),
      })

      setIsTracking(enabled)

      toast({
        title: enabled ? t('trackingEnabledTitle') : t('trackingDisabledTitle'),
        description: enabled ? t('trackingEnabledDescription') : t('trackingDisabledDescription'),
      })
    } catch (error) {
      toast({
        title: t('trackingErrorTitle'),
        description: t('trackingErrorDescription'),
        variant: "destructive",
      })
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex h-screen flex-col">
      {/* GDPR Privacy Notice */}
      <div className="bg-muted p-2 text-center text-sm">
        <p className="flex items-center justify-center gap-1">
          <AlertTriangle className="h-4 w-4" />
          {t('gdprNotice')}
        </p>
      </div>

      {/* Header */}
      <header className="border-b bg-background p-4">
        <h1 className="text-xl font-bold">{t('myLocation')}</h1>
      </header>

      {/* Status Bar */}
      <div className="border-b bg-background p-4">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1">
              <Clock className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">
                {t('lastUpdate')}: {employee ? formatLastUpdate(employee.lastUpdate) : t('loading')}
              </span>
            </div>
            <div className="flex items-center gap-1">
              <Battery className="h-4 w-4 text-muted-foreground" />
              <span className="text-sm">{t('battery')}: {employee ? `${employee.batteryLevel}%` : t('loading')}</span>
            </div>
          </div>
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-2">
              <Switch checked={isTracking} onCheckedChange={handleTrackingToggle} disabled={isLoading} />
              <span className="text-sm font-medium">{isTracking ? t('trackingEnabled') : t('trackingDisabled')}</span>
            </div>
            <Button onClick={handleCheckIn} disabled={isLoading}>
              <MapPin className="mr-2 h-4 w-4" />
              {t('checkInNow')}
            </Button>
          </div>
        </div>
      </div>

      {/* Map */}
      <div className="relative flex-1">
        <MapContainer
          employees={employee ? [employee] : []}
          selectedEmployee={employee}
          locationHistory={[]}
          isLoading={isLoading}
          isMobileView={true}
        />
      </div>

      {/* Status Indicator */}
      <div
        className={`fixed bottom-4 right-4 flex items-center gap-2 rounded-full px-4 py-2 text-white ${
          isTracking ? "bg-green-500" : "bg-red-500"
        }`}
      >
        <div className={`h-3 w-3 rounded-full ${isTracking ? "animate-pulse bg-white" : "bg-white"}`} />
        <span className="text-sm font-medium">{isTracking ? t('locationTrackingActive') : t('trackingPaused')}</span>
      </div>
    </div>
  )
}
