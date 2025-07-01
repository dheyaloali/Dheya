'use client';

import { useEffect, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { Geolocation, Position } from '@capacitor/geolocation';
import { PushNotifications } from '@capacitor/push-notifications';
import { Camera, CameraResultType, CameraSource } from '@capacitor/camera';
import { Preferences } from '@capacitor/preferences';
import { Network } from '@capacitor/network';
import { App } from '@capacitor/app';

export interface CapacitorFeatures {
  isNative: boolean;
  isOnline: boolean;
  getCurrentPosition: () => Promise<Position | null>;
  takePicture: () => Promise<string | null>;
  storeData: (key: string, value: string) => Promise<void>;
  getData: (key: string) => Promise<string | null>;
  removeData: (key: string) => Promise<void>;
  exitApp: () => Promise<void>;
}

export function useCapacitorFeatures(): CapacitorFeatures {
  const [isNative, setIsNative] = useState(false);
  const [isOnline, setIsOnline] = useState(true);

  useEffect(() => {
    // Check if running in Capacitor
    setIsNative(Capacitor.isNativePlatform());

    // Set up network status listener
    const setupNetworkListener = async () => {
      try {
        // Initial network status
        const status = await Network.getStatus();
        setIsOnline(status.connected);

        // Listen for network status changes
        Network.addListener('networkStatusChange', (status) => {
          setIsOnline(status.connected);
        });
      } catch (error) {
        console.error('Network status error:', error);
      }
    };

    setupNetworkListener();

    return () => {
      // Clean up network listener
      Network.removeAllListeners();
    };
  }, []);

  // Get current position
  const getCurrentPosition = async (): Promise<Position | null> => {
    try {
      // Request permissions first
      const permissionStatus = await Geolocation.checkPermissions();
      
      if (permissionStatus.location !== 'granted') {
        await Geolocation.requestPermissions();
      }
      
      return await Geolocation.getCurrentPosition();
    } catch (error) {
      console.error('Error getting location:', error);
      return null;
    }
  };

  // Take a picture
  const takePicture = async (): Promise<string | null> => {
    try {
      const image = await Camera.getPhoto({
        quality: 90,
        allowEditing: true,
        resultType: CameraResultType.DataUrl,
        source: CameraSource.Camera,
      });

      return image.dataUrl || null;
    } catch (error) {
      console.error('Error taking picture:', error);
      return null;
    }
  };

  // Store data
  const storeData = async (key: string, value: string): Promise<void> => {
    try {
      if (isNative) {
        await Preferences.set({ key, value });
      } else {
        localStorage.setItem(key, value);
      }
    } catch (error) {
      console.error('Error storing data:', error);
    }
  };

  // Get data
  const getData = async (key: string): Promise<string | null> => {
    try {
      if (isNative) {
        const { value } = await Preferences.get({ key });
        return value;
      } else {
        return localStorage.getItem(key);
      }
    } catch (error) {
      console.error('Error getting data:', error);
      return null;
    }
  };

  // Remove data
  const removeData = async (key: string): Promise<void> => {
    try {
      if (isNative) {
        await Preferences.remove({ key });
      } else {
        localStorage.removeItem(key);
      }
    } catch (error) {
      console.error('Error removing data:', error);
    }
  };

  // Exit app
  const exitApp = async (): Promise<void> => {
    try {
      if (isNative) {
        await App.exitApp();
      } else {
        console.log('Exit app is only available on native platforms');
      }
    } catch (error) {
      console.error('Error exiting app:', error);
    }
  };

  return {
    isNative,
    isOnline,
    getCurrentPosition,
    takePicture,
    storeData,
    getData,
    removeData,
    exitApp,
  };
} 