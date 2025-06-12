'use client';

import { useEffect, useState } from 'react';
import { EmployeeLocationPage } from '@/components/employee/employee-location-page';
import { useSession } from 'next-auth/react';
import { redirect } from 'next/navigation';

export default function EmployeeLocationPageWrapper() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    if (status === 'loading') return;
    if (!session || session.user.role !== 'EMPLOYEE') {
      redirect('/login');
    }
    setLoading(false);
  }, [session, status]);
  
  if (loading) {
    return <div className="flex items-center justify-center h-screen">Loading...</div>;
  }
  
  return <EmployeeLocationPage employeeId={session?.user?.id} />;
}