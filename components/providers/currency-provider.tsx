"use client";

import React, { createContext, useContext, useState, useEffect, useCallback } from 'react';
import { 
  CurrencyCode, 
  CurrencyConfig, 
  CURRENCY_CONFIGS, 
  formatCurrency, 
  parseCurrency, 
  setCurrency, 
  getCurrentCurrency, 
  getCurrentConfig,
  getExchangeRate,
  initializeCurrency
} from '@/lib/currency';
import { useSession } from 'next-auth/react';

interface CurrencyContextType {
  // Current currency state
  currentCurrency: CurrencyCode;
  currentConfig: CurrencyConfig;
  exchangeRate: number;
  
  // Currency management
  setCurrency: (currency: CurrencyCode, customExchangeRate?: number) => void;
  updateExchangeRate: (rate: number) => void;
  
  // Formatting functions
  formatCurrency: typeof formatCurrency;
  parseCurrency: typeof parseCurrency;
  
  // Utility functions
  formatPrice: (amount: number, currency?: CurrencyCode) => string;
  formatAmount: (amount: number, currency?: CurrencyCode) => string;
  formatCompactAmount: (amount: number, currency?: CurrencyCode) => string;
  
  // Admin controls
  isAdmin: boolean;
  availableCurrencies: CurrencyCode[];
  currencyConfigs: typeof CURRENCY_CONFIGS;
  
  // Loading state
  isLoading?: boolean;
}

// Create context with a default value to prevent undefined context
const defaultContextValue: CurrencyContextType = {
  currentCurrency: 'USD',
  currentConfig: CURRENCY_CONFIGS.USD,
  exchangeRate: CURRENCY_CONFIGS.USD.exchangeRate,
  setCurrency: () => {},
  updateExchangeRate: () => {},
  formatCurrency,
  parseCurrency,
  formatPrice: (amount: number) => formatCurrency(amount, { currency: 'USD', showSymbol: true }),
  formatAmount: (amount: number) => formatCurrency(amount, { currency: 'USD', showSymbol: true }),
  formatCompactAmount: (amount: number) => formatCurrency(amount, { currency: 'USD', showSymbol: true, compact: true }),
  isAdmin: false,
  availableCurrencies: ['USD'],
  currencyConfigs: CURRENCY_CONFIGS,
  isLoading: false,
};

const CurrencyContext = createContext<CurrencyContextType>(defaultContextValue);

// Safe wrapper for currency functions
const safeGetCurrentConfig = (): CurrencyConfig => {
  try {
    return getCurrentConfig();
  } catch (error) {
    console.error('Error getting current config:', error);
    return CURRENCY_CONFIGS.USD;
  }
};

const safeGetCurrentCurrency = (): CurrencyCode => {
  try {
    return getCurrentCurrency();
  } catch (error) {
    console.error('Error getting current currency:', error);
    return 'USD';
  }
};

const safeGetExchangeRate = (): number => {
  try {
    return getExchangeRate();
  } catch (error) {
    console.error('Error getting exchange rate:', error);
    return CURRENCY_CONFIGS.USD.exchangeRate;
  }
};

const safeInitializeCurrency = (): void => {
  try {
    initializeCurrency();
  } catch (error) {
    console.error('Error initializing currency:', error);
  }
};

export function CurrencyProvider({ children }: { children: React.ReactNode }) {
  // Safe session handling with fallback
  const { data: session, status } = useSession();
  const isAdmin = session?.user?.isAdmin ?? false;
  
  // Initialize with safe default values
  const [currentCurrency, setCurrentCurrencyState] = useState<CurrencyCode>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('currentCurrency') as CurrencyCode;
        return stored && CURRENCY_CONFIGS[stored] ? stored : 'USD';
      }
      return 'USD';
    } catch (error) {
      console.error('Error initializing currentCurrency:', error);
      return 'USD';
    }
  });
  
  const [exchangeRate, setExchangeRateState] = useState<number>(() => {
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('exchangeRate');
        return stored ? parseFloat(stored) : CURRENCY_CONFIGS.USD.exchangeRate;
      }
      return CURRENCY_CONFIGS.USD.exchangeRate;
    } catch (error) {
      console.error('Error initializing exchangeRate:', error);
      return CURRENCY_CONFIGS.USD.exchangeRate;
    }
  });

  // Safe currency initialization
  useEffect(() => {
    const loadCurrencySettings = async () => {
      try {
        safeInitializeCurrency();
        
        if (status === 'authenticated' && isAdmin) {
          try {
            const response = await fetch('/api/admin/settings');
            if (response.ok) {
              const settings = await response.json();
              if (settings.defaultCurrency && settings.exchangeRate) {
                setCurrency(settings.defaultCurrency as CurrencyCode, settings.exchangeRate);
                setCurrentCurrencyState(settings.defaultCurrency as CurrencyCode);
                setExchangeRateState(settings.exchangeRate);
                return;
              }
            }
          } catch (error) {
            console.error('Error loading admin settings:', error);
          }
        }
        
        const current = safeGetCurrentCurrency();
        const rate = safeGetExchangeRate();
        setCurrentCurrencyState(current);
        setExchangeRateState(rate);
      } catch (error) {
        console.error('Error in loadCurrencySettings:', error);
        // Keep current state, don't reset
      }
    };
    
    loadCurrencySettings();
  }, [status, isAdmin]);

  // Safe currency management functions
  const handleSetCurrency = useCallback((currency: CurrencyCode, customExchangeRate?: number) => {
    try {
      setCurrency(currency, customExchangeRate);
      setCurrentCurrencyState(currency);
      setExchangeRateState(customExchangeRate ?? CURRENCY_CONFIGS[currency].exchangeRate);
    } catch (error) {
      console.error('Error setting currency:', error);
    }
  }, []);

  const updateExchangeRate = useCallback((rate: number) => {
    try {
      setCurrency(currentCurrency, rate);
      setExchangeRateState(rate);
    } catch (error) {
      console.error('Error updating exchange rate:', error);
    }
  }, [currentCurrency]);

  // Safe formatting functions
  const formatPrice = useCallback((amount: number, currency?: CurrencyCode) => {
    try {
      return formatCurrency(amount, { currency: currency ?? currentCurrency, showSymbol: true });
    } catch (error) {
      console.error('Error formatting price:', error);
      return `$${amount.toLocaleString()}`;
    }
  }, [currentCurrency]);

  const formatAmount = useCallback((amount: number, currency?: CurrencyCode) => {
    try {
      return formatCurrency(amount, { currency: currency ?? currentCurrency, showSymbol: true });
    } catch (error) {
      console.error('Error formatting amount:', error);
      return `$${amount.toLocaleString()}`;
    }
  }, [currentCurrency]);

  const formatCompactAmount = useCallback((amount: number, currency?: CurrencyCode) => {
    try {
      return formatCurrency(amount, { currency: currency ?? currentCurrency, showSymbol: true, compact: true });
    } catch (error) {
      console.error('Error formatting compact amount:', error);
      return `$${amount.toLocaleString()}`;
    }
  }, [currentCurrency]);

  // Safe available currencies
  const availableCurrencies: CurrencyCode[] = isAdmin 
    ? Object.keys(CURRENCY_CONFIGS) as CurrencyCode[]
    : [currentCurrency];

  // Safe context value creation
  const contextValue: CurrencyContextType = {
    currentCurrency,
    currentConfig: safeGetCurrentConfig(),
    exchangeRate,
    setCurrency: handleSetCurrency,
    updateExchangeRate,
    formatCurrency,
    parseCurrency,
    formatPrice,
    formatAmount,
    formatCompactAmount,
    isAdmin,
    availableCurrencies,
    currencyConfigs: CURRENCY_CONFIGS,
  };

  // Always render the provider with a valid context
  return (
    <CurrencyContext.Provider value={contextValue}>
      {children}
    </CurrencyContext.Provider>
  );
}

export function useCurrency() {
  const context = useContext(CurrencyContext);
  // Context will never be undefined due to default value
  return context;
}

export function useCurrencyAdmin() {
  const context = useCurrency();
  const { status } = useSession();
  
  // Always return with loading state when session is loading
  if (status === 'loading') {
    return {
      ...context,
      isLoading: true
    };
  }
  
  // Only check isAdmin if session is fully loaded
  if (!context.isAdmin) {
    throw new Error('useCurrencyAdmin must be used by admin users only');
  }
  
  return {
    ...context,
    isLoading: false
  };
} 