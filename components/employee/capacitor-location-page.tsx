"use client"

import { useState, useEffect, useRef } from "react"
import { MapContainer } from "../admin/map-container"
import { Button } from "../ui/button"
import { Switch } from "../ui/switch"
import { useToast } from "../ui/use-toast"
import type { Employee } from "../../lib/types"
import apiClient from "../../lib/api-client"
import { MapPin, Battery, Clock, AlertTriangle, Wifi, WifiOff } from "lucide-react"
import { useTranslations } from "next-intl"

// Add TypeScript declaration for window object
declare global {
  interface Window {
    _pendingRequests?: Map<string, AbortController>;
    locationTrackingInterval?: number;
  }
}

// Safe dynamic imports for Capacitor
const importCapacitor = async () => {
  if (typeof window === 'undefined') return null;
  try {
    return await import('@capacitor/core');
  } catch (error) {
    console.error('Failed to import Capacitor:', error);
    return null;
  }
};

const importGeolocation = async () => {
  if (typeof window === 'undefined') return null;
  try {
    return await import('@capacitor/geolocation');
  } catch (error) {
    console.error('Failed to import Geolocation:', error);
    return null;
  }
};

const importDevice = async () => {
  if (typeof window === 'undefined') return null;
  try {
    return await import('@capacitor/device');
  } catch (error) {
    console.error('Failed to import Device:', error);
    return null;
  }
};

const importNetwork = async () => {
  if (typeof window === 'undefined') return null;
  try {
    return await import('@capacitor/network');
  } catch (error) {
    console.error('Failed to import Network:', error);
    return null;
  }
};

// Simple component that loads full functionality at runtime
export function CapacitorLocationPage({ employeeId }: { employeeId?: string }) {
  const [employee, setEmployee] = useState<Employee | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [isTracking, setIsTracking] = useState(false)
  const [isNative, setIsNative] = useState(false)
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null)
  const [isOnline, setIsOnline] = useState(true)
  const { toast } = useToast()
  const t = useTranslations('Location')

  // Check if running in native environment
  useEffect(() => {
    const checkPlatform = async () => {
      const capacitorModule = await importCapacitor();
      if (capacitorModule) {
        const isNativePlatform = capacitorModule.Capacitor.isNativePlatform();
        setIsNative(isNativePlatform);
        console.log('Running in native environment:', isNativePlatform);
      }
    };
    
    checkPlatform();
  }, []);

  // Set up network status listener
  useEffect(() => {
    if (!isNative) return;
    
    const setupNetworkListener = async () => {
      const networkModule = await importNetwork();
      if (!networkModule) return;
      
      try {
        const { Network } = networkModule;
        const status = await Network.getStatus();
        setIsOnline(status.connected);
        
        Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
        });
        
        return () => {
          Network.removeAllListeners();
        };
      } catch (error) {
        console.error('Error setting up network listener:', error);
      }
    };
    
    setupNetworkListener();
  }, [isNative]);

  // Get battery level
  const getBatteryLevel = async () => {
    if (!isNative) return null;
    
    const deviceModule = await importDevice();
    if (!deviceModule) return null;
    
    try {
      const { Device } = deviceModule;
      const batteryInfo = await Device.getBatteryInfo();
      const level = Math.round((batteryInfo.batteryLevel || 0) * 100);
      setBatteryLevel(level);
      return level;
    } catch (error) {
      console.error('Error getting battery level:', error);
      return null;
    }
  };

  // Fetch current employee data
  useEffect(() => {
    const getCurrentEmployee = async () => {
      try {
        setIsLoading(true);
        const data = await apiClient.fetchCurrentEmployee();
        setEmployee(data);
        setIsTracking(data.isActive);
        
        // Get battery level if in native environment
        if (isNative) {
          await getBatteryLevel();
        }
      } catch (error) {
        toast({
          title: t('fetchErrorTitle'),
          description: t('fetchErrorDescription'),
          variant: "destructive",
        });
      } finally {
        setIsLoading(false);
      }
    };
    
    getCurrentEmployee();
    
    // Refresh employee data every 2 minutes
    const intervalId = setInterval(getCurrentEmployee, 120000);
    return () => clearInterval(intervalId);
  }, [toast, t, isNative]);

  // Format the last update time
  const formatLastUpdate = (timestamp: number) => {
    const date = new Date(timestamp);
    return date.toLocaleString();
  };

  // Add this function to store data in preferences
  const storeData = async (key: string, value: string): Promise<void> => {
    if (!isNative) return;
    
    try {
      const capacitorModule = await importCapacitor();
      if (!capacitorModule) return;
      
      const { Preferences } = await import('@capacitor/preferences');
      await Preferences.set({ key, value });
    } catch (error) {
      console.error('Error storing data:', error);
    }
  };

  // Add this function to get data from preferences
  const getData = async (key: string): Promise<string | null> => {
    if (!isNative) return null;
    
    try {
      const capacitorModule = await importCapacitor();
      if (!capacitorModule) return null;
      
      const { Preferences } = await import('@capacitor/preferences');
      const { value } = await Preferences.get({ key });
      return value;
    } catch (error) {
      console.error('Error getting data:', error);
      return null;
    }
  };

  // Add this function to get current position
  const getCurrentPosition = async () => {
    if (!isNative) return null;
    
    try {
      const geolocationModule = await importGeolocation();
      if (!geolocationModule) {
        throw new Error('Failed to load geolocation plugin');
      }
      
      const { Geolocation } = geolocationModule;
      
      // Adjust accuracy based on battery level
      const useHighAccuracy = !batteryLevel || batteryLevel > 20;
      
      const position = await Geolocation.getCurrentPosition({
        enableHighAccuracy: useHighAccuracy,
        timeout: useHighAccuracy ? 10000 : 30000
      });
      
      return position;
    } catch (error) {
      console.error('Error getting position:', error);
      return null;
    }
  };

  // Add this function to setup background tracking
  const setupBackgroundTracking = async (enabled: boolean) => {
    if (!isNative) return;
    
    try {
      // Store tracking preference
      await storeData('tracking_enabled', enabled ? 'true' : 'false');
      
      // Clear any existing interval to avoid duplicates
      if (window.locationTrackingInterval) {
        clearInterval(window.locationTrackingInterval);
        window.locationTrackingInterval = undefined;
      }
      
      if (enabled) {
        // Get initial position
        const position = await getCurrentPosition();
        if (position) {
          // Update location immediately
          await updateLocationWithOfflineSupport(position);
        }
        
        // Set up real-time tracking intervals
        const getIntervalTime = () => {
          if (batteryLevel && batteryLevel < 20) {
            return 30 * 1000; // 30 seconds when battery low
          } else if (batteryLevel && batteryLevel < 50) {
            return 20 * 1000; // 20 seconds when battery medium
          }
          return 10 * 1000; // 10 seconds for real-time tracking
        };
        
        // Store the interval ID globally to ensure it can be cleared
        window.locationTrackingInterval = window.setInterval(async () => {
          try {
            // Only proceed if tracking is still enabled
            const isStillTracking = await getData('tracking_enabled');
            if (isStillTracking !== 'true') {
              if (window.locationTrackingInterval) {
                clearInterval(window.locationTrackingInterval);
                window.locationTrackingInterval = undefined;
              }
              return;
            }
            
            // Get position
            const position = await getCurrentPosition();
            if (position) {
              await updateLocationWithOfflineSupport(position);
            }
          } catch (error) {
            console.error('Background location error:', error);
          }
        }, getIntervalTime());
      }
    } catch (error) {
      console.error('Error setting up background tracking:', error);
    }
  };

  // Add this function to update location with offline support
  const updateLocationWithOfflineSupport = async (position: any) => {
    try {
      const locationData = {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
        accuracy: position.coords.accuracy,
        timestamp: Date.now(),
        batteryLevel: batteryLevel || undefined
      };
      
      // Try to send to server
      if (isOnline) {
        await apiClient.updateEmployeeLocation(locationData);
      } else {
        // If offline, store location
        const pendingLocationsStr = await getData('pending_locations');
        const pendingLocations = pendingLocationsStr ? JSON.parse(pendingLocationsStr) : [];
        
        pendingLocations.push(locationData);
        
        // Limit queue size to prevent storage issues
        if (pendingLocations.length > 100) {
          pendingLocations.splice(0, pendingLocations.length - 100);
        }
        
        await storeData('pending_locations', JSON.stringify(pendingLocations));
      }
    } catch (error) {
      console.error('Error updating location:', error);
      
      // Store failed location update
      try {
        const pendingLocationsStr = await getData('pending_locations');
        const pendingLocations = pendingLocationsStr ? JSON.parse(pendingLocationsStr) : [];
        
        pendingLocations.push({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          accuracy: position.coords.accuracy,
          timestamp: Date.now(),
          batteryLevel: batteryLevel || undefined
        });
        
        // Limit queue size
        if (pendingLocations.length > 100) {
          pendingLocations.splice(0, pendingLocations.length - 100);
        }
        
        await storeData('pending_locations', JSON.stringify(pendingLocations));
      } catch (storageError) {
        console.error('Failed to store location locally:', storageError);
      }
    }
  };

  // Add this function to sync pending locations
  const syncPendingLocations = async () => {
    if (!isNative) return;
    
    try {
      const pendingLocationsStr = await getData('pending_locations');
      if (!pendingLocationsStr) return;
      
      const pendingLocations = JSON.parse(pendingLocationsStr);
      if (!pendingLocations.length) return;
      
      // Process in small batches
      const batchSize = 5;
      let successCount = 0;
      
      for (let i = 0; i < pendingLocations.length; i += batchSize) {
        const batch = pendingLocations.slice(i, Math.min(i + batchSize, pendingLocations.length));
        
        try {
          // Use existing API client for each location
          for (const location of batch) {
            await apiClient.updateEmployeeLocation(location);
            successCount++;
          }
        } catch (error) {
          console.error('Error syncing location batch:', error);
          // Stop on first error to preserve remaining items
          break;
        }
      }
      
      // Remove successfully synced locations
      if (successCount > 0) {
        const remainingLocations = pendingLocations.slice(successCount);
        await storeData('pending_locations', JSON.stringify(remainingLocations));
      }
    } catch (error) {
      console.error('Error syncing pending locations:', error);
    }
  };

  // Add useEffect for tracking state restoration
  useEffect(() => {
    if (!isNative) return;
    
    // Load tracking state on component mount
    const loadTrackingState = async () => {
      const trackingEnabled = await getData('tracking_enabled');
      if (trackingEnabled === 'true') {
        setIsTracking(true);
        await setupBackgroundTracking(true);
      }
    };
    
    loadTrackingState();
    
    // Clean up on unmount
    return () => {
      if (window.locationTrackingInterval) {
        clearInterval(window.locationTrackingInterval);
        window.locationTrackingInterval = undefined;
      }
    };
  }, [isNative]);

  // Add useEffect for network status and syncing
  useEffect(() => {
    if (!isNative || !isOnline) return;
    
    // Sync pending locations when online
    syncPendingLocations();
  }, [isNative, isOnline]);

  // Handle manual check-in
  const handleCheckIn = async () => {
    if (!employee) return;
    
    try {
      setIsLoading(true);
      
      if (isNative) {
        const geolocationModule = await importGeolocation();
        if (!geolocationModule) {
          throw new Error('Failed to load geolocation plugin');
        }
        
        const { Geolocation } = geolocationModule;
        const position = await Geolocation.getCurrentPosition({
          enableHighAccuracy: true,
          timeout: 10000
        });
        
        const battery = await getBatteryLevel();
        
        // Update employee location
        await apiClient.updateEmployeeLocation({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: Date.now(),
          batteryLevel: battery || undefined
        });
        
        // Refresh employee data
        const updatedEmployee = await apiClient.fetchCurrentEmployee();
        setEmployee(updatedEmployee);
        
        toast({
          title: t('checkInSuccessTitle'),
          description: t('checkInSuccessDescription'),
        });
      } else {
        // Fall back to browser geolocation
        navigator.geolocation.getCurrentPosition(
          async (position) => {
            await apiClient.updateEmployeeLocation({
              latitude: position.coords.latitude,
              longitude: position.coords.longitude,
              timestamp: Date.now()
            });
            
            const updatedEmployee = await apiClient.fetchCurrentEmployee();
            setEmployee(updatedEmployee);
            
            toast({
              title: t('checkInSuccessTitle'),
              description: t('checkInSuccessDescription'),
            });
          },
          (error) => {
            console.error("Geolocation error:", error);
            toast({
              title: t('locationErrorTitle'),
              description: t('locationErrorDescription'),
              variant: "destructive",
            });
          },
          { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
        );
      }
    } catch (error) {
      toast({
        title: t('checkInFailedTitle'),
        description: t('checkInFailedDescription'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Modify the existing handleTrackingToggle function
  const handleTrackingToggle = async (enabled: boolean) => {
    if (!employee) return;
    
    try {
      setIsLoading(true);
      
      // Update tracking status using existing API call
      await apiClient.updateEmployeeLocation({
        isActive: enabled,
        timestamp: Date.now(),
      });
      
      // Set up background tracking
      await setupBackgroundTracking(enabled);
      
      // Update UI state
      setIsTracking(enabled);
      
      // Use existing toast notifications
      toast({
        title: enabled ? t('trackingEnabledTitle') : t('trackingDisabledTitle'),
        description: enabled ? t('trackingEnabledDescription') : t('trackingDisabledDescription'),
      });
    } catch (error) {
      toast({
        title: t('trackingErrorTitle'),
        description: t('trackingErrorDescription'),
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

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
              <span className="text-sm">
                {t('battery')}: {batteryLevel !== null ? `${batteryLevel}%` : (employee ? `${employee.batteryLevel}%` : t('loading'))}
              </span>
            </div>
            <div className="flex items-center gap-1">
              {isOnline ? (
                <Wifi className="h-4 w-4 text-green-500" />
              ) : (
                <WifiOff className="h-4 w-4 text-red-500" />
              )}
              <span className="text-sm">
                {isOnline ? t('online') : t('offline')}
              </span>
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
        <span className="text-sm font-medium">
          {isNative 
            ? (isTracking ? t('locationTrackingActive') : t('trackingPaused'))
            : t('webModeActive')
          }
        </span>
      </div>
    </div>
  )
}