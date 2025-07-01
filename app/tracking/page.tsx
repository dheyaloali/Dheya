'use client';

import { useEffect, useState } from 'react';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';
import { EmployeeTrackingLayout } from '@/components/layouts/employee-tracking-layout';

// Dynamically import the CapacitorLocationPage component with no SSR
// This ensures it only loads in the browser and not during server-side rendering
const CapacitorLocationPage = dynamic(
  () => import('@/components/employee/capacitor-location-page').then(mod => ({ 
    default: ({ employeeId }: { employeeId?: string }) => <mod.CapacitorLocationPage employeeId={employeeId} /> 
  })),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen">Loading native tracking...</div>
  }
);

export default function TrackingPage() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  const [isNative, setIsNative] = useState(false);
  
  useEffect(() => {
    // Check if running in Capacitor native environment
    const checkPlatform = async () => {
      try {
        // Dynamic import to avoid SSR issues
        const Capacitor = (await import('@capacitor/core')).Capacitor;
        setIsNative(Capacitor.isNativePlatform());
      } catch (error) {
        console.error('Error importing Capacitor:', error);
        setIsNative(false);
      } finally {
        setLoading(false);
      }
    };
    
    // Only run in browser
    if (typeof window !== 'undefined') {
      checkPlatform();
    }
    
    // Handle authentication
    if (status !== 'loading' && (!session || session.user?.role !== 'EMPLOYEE')) {
      redirect('/login');
    }
  }, [session, status]);
  
  if (loading || status === 'loading') {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  // Use the EmployeeTrackingLayout for native app tracking
  return (
    <EmployeeTrackingLayout user={session?.user}>
      {isNative ? (
        <CapacitorLocationPage employeeId={session?.user?.id} />
      ) : (
        <div className="flex items-center justify-center h-screen">
          <div className="text-center">
            <h2 className="text-xl font-bold mb-2">Native App Required</h2>
            <p className="text-muted-foreground">
              This tracking page is designed for the native mobile app.
            </p>
          </div>
        </div>
      )}
    </EmployeeTrackingLayout>
  );
} 