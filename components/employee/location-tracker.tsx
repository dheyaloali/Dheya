"use client";

import { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { useToast } from "@/components/ui/use-toast";
import { MapPin, Battery, Wifi, AlertTriangle } from "lucide-react";
import { useCapacitorFeatures } from "@/hooks/useCapacitorFeatures";
import { useSession } from "next-auth/react";

export function LocationTracker() {
  const { data: session } = useSession();
  const { toast } = useToast();
  const { isNative, geolocation } = useCapacitorFeatures();
  
  const [tracking, setTracking] = useState(false);
  const [location, setLocation] = useState<any>(null);
  const [battery, setBattery] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isOnline, setIsOnline] = useState(true);
  const [pendingLocations, setPendingLocations] = useState<any[]>([]);
  
  // Get battery level (web fallback)
  useEffect(() => {
    if (!isNative && 'getBattery' in navigator) {
      // @ts-ignore - getBattery is not in the standard navigator type
      navigator.getBattery().then((battery: any) => {
        setBattery(battery.level * 100);
        
        battery.addEventListener('levelchange', () => {
          setBattery(battery.level * 100);
        });
      }).catch(err => {
        console.error('Error getting battery info:', err);
      });
    }
  }, [isNative]);
  
  // Handle online/offline status
  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);
  
  // Sync pending locations when back online
  useEffect(() => {
    if (isOnline && pendingLocations.length > 0) {
      const syncLocations = async () => {
        try {
          // Create a copy of pending locations
          const locationsToSync = [...pendingLocations];
          
          // Clear pending locations
          setPendingLocations([]);
          
          // Send locations to server
          const response = await fetch('/api/location-batch', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
            },
            body: JSON.stringify({ locations: locationsToSync }),
          });
          
          if (!response.ok) {
            throw new Error('Failed to sync locations');
          }
          
          toast({
            title: "Locations synced",
            description: `${locationsToSync.length} locations synced successfully`,
          });
        } catch (error) {
          console.error('Error syncing locations:', error);
          
          // Put locations back in pending
          setPendingLocations(prev => [...prev, ...pendingLocations]);
          
          toast({
            title: "Sync failed",
            description: "Failed to sync locations. Will retry later.",
            variant: "destructive",
          });
        }
      };
      
      syncLocations();
    }
  }, [isOnline, pendingLocations, toast]);
  
  // Start/stop tracking
  const toggleTracking = () => {
    if (tracking) {
      // Stop tracking
      setTracking(false);
      return;
    }
    
    // Start tracking
    setTracking(true);
    
    // Get initial location
    geolocation.getCurrentPosition()
      .then(position => {
        if (!position) {
          throw new Error('Failed to get position');
        }
        
        handleNewPosition(position);
      })
      .catch(err => {
        setError(`Error getting location: ${err.message}`);
        setTracking(false);
        
        toast({
          title: "Location Error",
          description: `Failed to get location: ${err.message}`,
          variant: "destructive",
        });
      });
  };
  
  // Handle new position data
  const handleNewPosition = async (position: any) => {
    const { coords, timestamp } = position;
    
    // Update local state
    setLocation({
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      timestamp,
    });
    
    // Prepare location data
    const locationData = {
      latitude: coords.latitude,
      longitude: coords.longitude,
      accuracy: coords.accuracy,
      timestamp,
      battery: battery || 0,
      isMoving: true, // We could calculate this based on previous positions
      employeeId: session?.user?.id,
    };
    
    // If online, send to server, otherwise store locally
    if (isOnline) {
      try {
        const response = await fetch('/api/location-update', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify(locationData),
        });
        
        if (!response.ok) {
          throw new Error('Failed to update location');
        }
      } catch (error) {
        console.error('Error updating location:', error);
        
        // Store for later sync
        setPendingLocations(prev => [...prev, locationData]);
        
        toast({
          title: "Connection Issue",
          description: "Location saved offline and will sync when online",
        });
      }
    } else {
      // Store for later sync
      setPendingLocations(prev => [...prev, locationData]);
    }
  };
  
  // Setup location tracking
  useEffect(() => {
    if (!tracking) return;
    
    // Watch position
    const cleanupWatcher = geolocation.watchPosition(handleNewPosition);
    
    // Cleanup
    return () => {
      cleanupWatcher();
    };
  }, [tracking, geolocation]);
  
  return (
    <Card className="w-full">
      <CardHeader className="bg-primary text-primary-foreground">
        <CardTitle className="flex items-center gap-2">
          <MapPin className="h-5 w-5" />
          Location Tracking
        </CardTitle>
      </CardHeader>
      <CardContent className="pt-6">
        <div className="space-y-4">
          {/* Status indicators */}
          <div className="flex items-center justify-between text-sm">
            <div className="flex items-center gap-2">
              <Battery className={`h-4 w-4 ${battery && battery < 20 ? 'text-red-500' : 'text-green-500'}`} />
              <span>Battery: {battery !== null ? `${Math.round(battery)}%` : 'Unknown'}</span>
            </div>
            <div className="flex items-center gap-2">
              <Wifi className={`h-4 w-4 ${isOnline ? 'text-green-500' : 'text-red-500'}`} />
              <span>{isOnline ? 'Online' : 'Offline'}</span>
            </div>
          </div>
          
          {/* Location display */}
          {location && (
            <div className="rounded-md bg-muted p-3 text-sm">
              <div className="grid grid-cols-2 gap-2">
                <div>Latitude: {location.latitude.toFixed(6)}</div>
                <div>Longitude: {location.longitude.toFixed(6)}</div>
                <div>Accuracy: {Math.round(location.accuracy)}m</div>
                <div>Updated: {new Date(location.timestamp).toLocaleTimeString()}</div>
              </div>
            </div>
          )}
          
          {/* Pending locations */}
          {pendingLocations.length > 0 && (
            <div className="flex items-center gap-2 rounded-md bg-yellow-50 p-3 text-sm text-yellow-800">
              <AlertTriangle className="h-4 w-4" />
              <span>{pendingLocations.length} location updates pending sync</span>
            </div>
          )}
          
          {/* Error message */}
          {error && (
            <div className="rounded-md bg-red-50 p-3 text-sm text-red-800">
              {error}
            </div>
          )}
          
          {/* Toggle button */}
          <Button 
            onClick={toggleTracking}
            className={tracking ? 'bg-red-500 hover:bg-red-600' : 'bg-primary'}
            fullWidth
          >
            {tracking ? 'Stop Tracking' : 'Start Tracking'}
          </Button>
          
          {/* Offline warning */}
          {!isOnline && !tracking && (
            <div className="text-center text-sm text-red-500">
              You must be online to start tracking
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}
