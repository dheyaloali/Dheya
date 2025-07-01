'use client';

import React from 'react';
import { CapacitorApiProvider } from '../capacitor-api-provider';
import { CapacitorRouterProvider } from '../capacitor-router';
import { MobileRouteWrapper } from '../mobile-route-wrapper';
import { CapacitorPushHandler } from '../capacitor-push-handler';
import { CurrencyProvider } from './currency-provider';

// Updated with MobileRouteWrapper, CapacitorPushHandler, and CurrencyProvider
export const Providers = ({ children }: { children: React.ReactNode }) => (
  <CapacitorApiProvider>
    <CapacitorRouterProvider>
      <MobileRouteWrapper>
        <CapacitorPushHandler />
        <CurrencyProvider>
          {children}
        </CurrencyProvider>
      </MobileRouteWrapper>
    </CapacitorRouterProvider>
  </CapacitorApiProvider>
); 