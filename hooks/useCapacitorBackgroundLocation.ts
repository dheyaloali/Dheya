import { useEffect, useState, useRef } from 'react';
import { Capacitor } from '@capacitor/core';
import { BackgroundGeolocation } from '@capacitor-community/background-geolocation';
import { useToast } from '@/components/ui/use-toast';
import apiClient from '@/lib/api-client';
import { Device } from '@capacitor/device';

interface LocationData {
  latitude: number;
  longitude: number;
  accuracy?: number;
  timestamp: number;
  batteryLevel?: number;
  isMoving?: boolean;
}

export function useCapacitorBackgroundLocation() {
  const [isTracking, setIsTracking] = useState(false);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [batteryLevel, setBatteryLevel] = useState<number | null>(null);
  const { toast } = useToast();
  
  const lastSentRef = useRef<{ lat: number; lng: number; time: number } | null>(null);

  // Get battery level
  const getBatteryLevel = async () => {
    try {
      if (Capacitor.isNativePlatform()) {
        const batteryInfo = await Device.getBatteryInfo();
        setBatteryLevel(batteryInfo.batteryLevel * 100); // Convert from 0-1 to percentage
        return batteryInfo.batteryLevel * 100;
      }
      return null;
    } catch (err) {
      console.error('Error getting battery level:', err);
      return null;
    }
  };

  // Initialize background geolocation
  const initBackgroundGeolocation = async () => {
    if (!Capacitor.isNativePlatform()) {
      setError('Background geolocation is only available on native platforms');
      return;
    }

    try {
      // Request permissions
      const permissions = await BackgroundGeolocation.requestPermissions();
      
      if (!permissions.backgroundLocation) {
        setError('Background location permission not granted');
        toast({
          title: "Permission Error",
          description: "Background location permission is required for tracking",
          variant: "destructive",
        });
        return;
      }

      // Configure the plugin
      await BackgroundGeolocation.configure({
        notificationTitle: 'Location Tracking',
        notificationText: 'Tracking your location in the background',
        distanceFilter: 10, // minimum distance in meters
        startForeground: true,
        debug: false,
        stoppedElapsedTimeInSeconds: 60
      });

      // Listen for location updates
      await BackgroundGeolocation.addWatcher(
        {
          requestPermissions: false,
          backgroundMessage: "Location tracking is enabled",
          backgroundTitle: "Location Tracking",
          distanceFilter: 10,
          stoppedTimeout: 60
        },
        (location, error) => {
          if (error) {
            console.error('Background location error:', error);
            setError(`Location error: ${error.message}`);
            return;
          }
          
          if (location) {
            handleLocationUpdate({
              latitude: location.latitude,
              longitude: location.longitude,
              accuracy: location.accuracy,
              timestamp: location.time || Date.now(),
              isMoving: true
            });
          }
        }
      );

      setIsTracking(true);
      setError(null);
    } catch (err: any) {
      console.error('Error initializing background geolocation:', err);
      setError(`Failed to initialize background tracking: ${err.message}`);
      toast({
        title: "Tracking Error",
        description: `Failed to initialize background tracking: ${err.message}`,
        variant: "destructive",
      });
    }
  };

  // Handle location update
  const handleLocationUpdate = async (location: LocationData) => {
    const { latitude, longitude, timestamp } = location;
    const now = Date.now();
    
    // Get battery level
    const battery = await getBatteryLevel();
    
    // Update current location state
    setCurrentLocation({
      ...location,
      batteryLevel: battery || undefined
    });
    
    // Throttle: only send if moved >10m or >10s since last sent
    const last = lastSentRef.current;
    const dist = last
      ? Math.sqrt(
          Math.pow(latitude - last.lat, 2) + Math.pow(longitude - last.lng, 2)
        ) * 111139 // rough meters per degree
      : Infinity;
      
    if (!last || dist > 10 || now - last.time > 10000) {
      try {
        await apiClient.updateEmployeeLocation({
          latitude,
          longitude,
          timestamp,
          batteryLevel: battery || undefined
        });
        
        lastSentRef.current = { lat: latitude, lng: longitude, time: now };
      } catch (error: any) {
        console.error('Failed to update location:', error);
        setError(`Failed to update location: ${error.message}`);
      }
    }
  };

  // Start tracking
  const startTracking = async () => {
    if (isTracking) return;
    await initBackgroundGeolocation();
  };

  // Stop tracking
  const stopTracking = async () => {
    if (!isTracking) return;
    
    try {
      if (Capacitor.isNativePlatform()) {
        await BackgroundGeolocation.removeWatcher({ id: 'location-watcher' });
      }
      setIsTracking(false);
    } catch (err: any) {
      console.error('Error stopping background geolocation:', err);
      setError(`Failed to stop background tracking: ${err.message}`);
    }
  };

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (Capacitor.isNativePlatform() && isTracking) {
        BackgroundGeolocation.removeWatcher({ id: 'location-watcher' })
          .catch(err => console.error('Error removing watcher:', err));
      }
    };
  }, [isTracking]);

  return {
    isTracking,
    currentLocation,
    error,
    batteryLevel,
    startTracking,
    stopTracking
  };
} 