'use client';

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card";
import { Smartphone, Download, Info } from "lucide-react";
import Link from "next/link";
import { useEffect } from "react";
import { signOut } from "next-auth/react";

export default function EmployeeAppRequiredPage() {
  // Automatically sign out the user when they reach this page
  useEffect(() => {
    // Small delay to ensure the page renders first
    const timer = setTimeout(() => {
      signOut({ redirect: false });
    }, 500);
    
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gradient-to-b from-blue-50 to-white p-4">
      <Card className="w-full max-w-md shadow-lg">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 flex h-16 w-16 items-center justify-center rounded-full bg-blue-100">
            <Smartphone className="h-8 w-8 text-blue-600" />
          </div>
          <CardTitle className="text-2xl font-bold">Mobile App Required</CardTitle>
          <CardDescription>
            For security and location tracking purposes, employees must use our mobile app.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="rounded-md bg-amber-50 p-4">
            <div className="flex items-start">
              <div className="flex-shrink-0">
                <Info className="h-5 w-5 text-amber-400" aria-hidden="true" />
              </div>
              <div className="ml-3">
                <h3 className="text-sm font-medium text-amber-800">Why is this required?</h3>
                <div className="mt-2 text-sm text-amber-700">
                  <ul className="list-disc space-y-1 pl-5">
                    <li>Accurate location tracking for attendance verification</li>
                    <li>Enhanced security features</li>
                    <li>Offline capability for field operations</li>
                    <li>Consistent user experience across all employees</li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        </CardContent>
        <CardFooter className="flex flex-col space-y-3">
          <Button className="w-full" asChild>
            <Link href="https://play.google.com/store/apps/details?id=com.employeemanagement.app" target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Download Android App
            </Link>
          </Button>
          <Button className="w-full" variant="outline" asChild>
            <Link href="https://apps.apple.com/app/employee-management/id123456789" target="_blank" rel="noopener noreferrer">
              <Download className="mr-2 h-4 w-4" />
              Download iOS App
            </Link>
          </Button>
          <p className="mt-4 text-center text-sm text-muted-foreground">
            If you believe this is an error, please contact your administrator.
          </p>
        </CardFooter>
      </Card>
    </div>
  );
} 