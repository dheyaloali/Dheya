import React from 'react';
import { SessionProvider } from 'next-auth/react';
import { CapacitorApiProvider } from '../capacitor-api-provider';
import { CapacitorRouterProvider } from '../capacitor-router';
import { MobileRouteWrapper } from '../mobile-route-wrapper';
import { CurrencyProvider } from "./currency-provider";

// Updated with SessionProvider and proper provider order
export const Providers = ({ children }: { children: React.ReactNode }) => (
  <SessionProvider>
    <CurrencyProvider>
      <CapacitorApiProvider>
        <CapacitorRouterProvider>
          <MobileRouteWrapper>
            {children}
          </MobileRouteWrapper>
        </CapacitorRouterProvider>
      </CapacitorApiProvider>
    </CurrencyProvider>
  </SessionProvider>
);
