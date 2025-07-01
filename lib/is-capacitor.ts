/**
 * Utility to detect if the app is running in Capacitor/native environment
 */

export function isCapacitorApp(): boolean {
  // Check if we're in a browser environment
  if (typeof window === 'undefined') {
    return false;
  }
  
  // Check for Capacitor bridge
  return (
    window.hasOwnProperty('Capacitor') || 
    (window as any)?.Capacitor !== undefined ||
    navigator.userAgent.includes('capacitor')
  );
} 