'use client';

import { useEffect, useState, Suspense } from 'react';
import { EmployeeLocationPage } from '@/components/employee/employee-location-page';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';
import dynamic from 'next/dynamic';

// Dynamically import the CapacitorLocationPage component with no SSR
// This ensures it only loads in the browser and not during server-side rendering
const CapacitorLocationPage = dynamic(
  () => import('@/components/employee/capacitor-location-page').then(mod => ({ 
    default: ({ employeeId }: { employeeId?: string }) => <mod.CapacitorLocationPage employeeId={employeeId} /> 
  })),
  { 
    ssr: false,
    loading: () => <div className="flex items-center justify-center h-screen">Loading native components...</div>
  }
);

export default function EmployeeLocationPageWrapper() {
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
  
  // Use the appropriate location page component based on environment
  return isNative ? (
    <CapacitorLocationPage employeeId={session?.user?.id} />
  ) : (
    <EmployeeLocationPage employeeId={session?.user?.id} />
  );
}