'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { useToast } from '@/hooks/use-toast';
import { useRouter } from 'next/navigation';

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

const importPushNotifications = async () => {
  if (typeof window === 'undefined') return null;
  try {
    return await import('@capacitor/push-notifications');
  } catch (error) {
    console.error('Failed to import Push Notifications:', error);
    return null;
  }
};

const importLocalNotifications = async () => {
  if (typeof window === 'undefined') return null;
  try {
    return await import('@capacitor/local-notifications');
  } catch (error) {
    console.error('Failed to import Local Notifications:', error);
    return null;
  }
};

/**
 * CapacitorPushHandler - Integrates with your existing notification system
 * 
 * This component doesn't render anything visible, but handles:
 * 1. Push notification registration
 * 2. Token management
 * 3. Notification reception and display
 * 4. Notification interaction
 */
export function CapacitorPushHandler() {
  const { data: session } = useSession();
  const router = useRouter();
  const { toast } = useToast();
  const [isNative, setIsNative] = useState(false);
  const [hasRegistered, setHasRegistered] = useState(false);

  // Check if running in native environment
  useEffect(() => {
    const checkPlatform = async () => {
      const capacitorModule = await importCapacitor();
      if (capacitorModule) {
        const isNativePlatform = capacitorModule.Capacitor.isNativePlatform();
        setIsNative(isNativePlatform);
        console.log('[CapacitorPushHandler] Running in native environment:', isNativePlatform);
      }
    };
    
    checkPlatform();
  }, []);

  // Register for push notifications
  useEffect(() => {
    if (!isNative || !session?.user || hasRegistered) return;

    const registerPushNotifications = async () => {
      try {
        const pushModule = await importPushNotifications();
        if (!pushModule) return;

        const { PushNotifications } = pushModule;

        // Check permission status
        const permissionStatus = await PushNotifications.checkPermissions();
        
        if (permissionStatus.receive === 'prompt') {
          // Request permissions
          const requestResult = await PushNotifications.requestPermissions();
          if (requestResult.receive !== 'granted') {
            console.log('[CapacitorPushHandler] Push notification permission denied');
            return;
          }
        } else if (permissionStatus.receive !== 'granted') {
          console.log('[CapacitorPushHandler] Push notification permission not granted');
          return;
        }

        // Register with FCM/APNS
        await PushNotifications.register();
        setHasRegistered(true);
        console.log('[CapacitorPushHandler] Push notifications registered');

        // Set up listeners
        PushNotifications.addListener('registration', (token) => {
          console.log('[CapacitorPushHandler] Registration success:', token.value);
          // Send token to server
          updateDeviceToken(token.value);
        });

        PushNotifications.addListener('registrationError', (error) => {
          console.error('[CapacitorPushHandler] Registration error:', error);
        });

        PushNotifications.addListener('pushNotificationReceived', (notification) => {
          console.log('[CapacitorPushHandler] Push notification received:', notification);
          // Show toast notification
          toast({
            title: notification.title || 'New notification',
            description: notification.body || '',
            action: notification.data?.actionUrl ? {
              label: 'View',
              onClick: () => router.push(notification.data.actionUrl),
            } : undefined,
          });
        });

        PushNotifications.addListener('pushNotificationActionPerformed', (action) => {
          console.log('[CapacitorPushHandler] Push notification action performed:', action);
          // Navigate to the relevant page if needed
          if (action.notification.data?.actionUrl) {
            router.push(action.notification.data.actionUrl);
          }
        });
      } catch (error) {
        console.error('[CapacitorPushHandler] Error setting up push notifications:', error);
      }
    };

    registerPushNotifications();

    // Cleanup
    return () => {
      const cleanupPushNotifications = async () => {
        if (!isNative) return;
        
        const pushModule = await importPushNotifications();
        if (!pushModule) return;
        
        const { PushNotifications } = pushModule;
        PushNotifications.removeAllListeners();
      };
      
      cleanupPushNotifications();
    };
  }, [isNative, session, router, toast, hasRegistered]);

  // Set up local notifications for offline/background scenarios
  useEffect(() => {
    if (!isNative || !session?.user) return;

    const setupLocalNotifications = async () => {
      try {
        const localNotificationsModule = await importLocalNotifications();
        if (!localNotificationsModule) return;

        const { LocalNotifications } = localNotificationsModule;

        // Request permissions
        const permissionStatus = await LocalNotifications.checkPermissions();
        
        if (permissionStatus.display === 'prompt') {
          const requestResult = await LocalNotifications.requestPermissions();
          if (requestResult.display !== 'granted') {
            console.log('[CapacitorPushHandler] Local notification permission denied');
            return;
          }
        } else if (permissionStatus.display !== 'granted') {
          console.log('[CapacitorPushHandler] Local notification permission not granted');
          return;
        }

        // Set up listeners
        LocalNotifications.addListener('localNotificationReceived', (notification) => {
          console.log('[CapacitorPushHandler] Local notification received:', notification);
        });

        LocalNotifications.addListener('localNotificationActionPerformed', (action) => {
          console.log('[CapacitorPushHandler] Local notification action performed:', action);
          if (action.notification.extra?.actionUrl) {
            router.push(action.notification.extra.actionUrl);
          }
        });
        
        console.log('[CapacitorPushHandler] Local notifications set up successfully');
      } catch (error) {
        console.error('[CapacitorPushHandler] Error setting up local notifications:', error);
      }
    };

    setupLocalNotifications();

    // Cleanup
    return () => {
      const cleanupLocalNotifications = async () => {
        if (!isNative) return;
        
        const localNotificationsModule = await importLocalNotifications();
        if (!localNotificationsModule) return;
        
        const { LocalNotifications } = localNotificationsModule;
        LocalNotifications.removeAllListeners();
      };
      
      cleanupLocalNotifications();
    };
  }, [isNative, session, router]);

  // Function to update device token on server
  const updateDeviceToken = async (token: string) => {
    if (!session?.user?.id) return;
    
    try {
      // Check if we already have this token stored to avoid duplicates
      const storedToken = localStorage.getItem('push_token');
      if (storedToken === token) {
        console.log('[CapacitorPushHandler] Token already registered');
        return;
      }
      
      const response = await fetch('/api/notifications/register-device', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ 
          token,
          userId: session.user.id,
          platform: (await importCapacitor())?.Capacitor.getPlatform() || 'unknown',
          tokenType: 'fcm'
        }),
      });

      if (response.ok) {
        // Store token locally to avoid re-registering
        localStorage.setItem('push_token', token);
        console.log('[CapacitorPushHandler] Device token registered successfully');
      } else {
        console.error('[CapacitorPushHandler] Failed to register device token');
      }
    } catch (error) {
      console.error('[CapacitorPushHandler] Error registering device token:', error);
    }
  };

  // Expose functions globally for use in other components
  useEffect(() => {
    if (!isNative || !window) return;

    // Create the global notification handler
    window.capacitorNotifications = {
      scheduleLocalNotification: async (title: string, body: string, actionUrl?: string) => {
        try {
          const localNotificationsModule = await importLocalNotifications();
          if (!localNotificationsModule) return;
          
          const { LocalNotifications } = localNotificationsModule;
          
          await LocalNotifications.schedule({
            notifications: [
              {
                title,
                body,
                id: new Date().getTime(),
                schedule: { at: new Date(Date.now() + 1000) },
                sound: 'default',
                attachments: null,
                actionTypeId: '',
                extra: actionUrl ? { actionUrl } : null,
              },
            ],
          });
          
          console.log('[CapacitorPushHandler] Local notification scheduled');
        } catch (error) {
          console.error('[CapacitorPushHandler] Error scheduling local notification:', error);
        }
      },
    };

    return () => {
      if (window) {
        delete window.capacitorNotifications;
      }
    };
  }, [isNative]);

  // This component doesn't render anything visible
  return null;
}

// Add TypeScript declaration for window object
declare global {
  interface Window {
    capacitorNotifications?: {
      scheduleLocalNotification: (title: string, body: string, actionUrl?: string) => Promise<void>;
    };
  }
}

export default CapacitorPushHandler; 