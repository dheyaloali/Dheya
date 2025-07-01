// Currency configuration and management system
export type CurrencyCode = 'USD' | 'IDR';

export interface CurrencyConfig {
  code: CurrencyCode;
  symbol: string;
  locale: string;
  decimalPlaces: number;
  exchangeRate: number; // Rate relative to USD (1 USD = X IDR)
  name: string;
  compactNotation: {
    thousand: string;
    million: string;
    billion: string;
    trillion: string;
  };
}

// Default currency configurations
export const CURRENCY_CONFIGS: Record<CurrencyCode, CurrencyConfig> = {
  USD: {
    code: 'USD',
    symbol: '$',
    locale: 'en-US',
    decimalPlaces: 2,
    exchangeRate: 1,
    name: 'US Dollar',
    compactNotation: {
      thousand: 'K',
      million: 'M',
      billion: 'B',
      trillion: 'T'
    }
  },
  IDR: {
    code: 'IDR',
    symbol: 'Rp',
    locale: 'id-ID',
    decimalPlaces: 0,
    exchangeRate: 15000, // 1 USD = 15,000 IDR (configurable)
    name: 'Indonesian Rupiah',
    compactNotation: {
      thousand: 'Rb',
      million: 'Jt',
      billion: 'M',
      trillion: 'T'
    }
  }
};

// Global currency state (will be managed by context)
let currentCurrency: CurrencyCode = 'USD';
let exchangeRate: number = CURRENCY_CONFIGS.USD.exchangeRate;

// Currency management functions
export function setCurrency(currency: CurrencyCode, customExchangeRate?: number) {
  currentCurrency = currency;
  exchangeRate = customExchangeRate ?? CURRENCY_CONFIGS[currency].exchangeRate;
  
  // Store in localStorage for persistence
  if (typeof window !== 'undefined') {
    localStorage.setItem('app-currency', currency);
    if (customExchangeRate) {
      localStorage.setItem('app-exchange-rate', customExchangeRate.toString());
    }
  }
}

export function getCurrentCurrency(): CurrencyCode {
  return currentCurrency;
}

export function getCurrentConfig(): CurrencyConfig {
  return CURRENCY_CONFIGS[currentCurrency];
}

export function getExchangeRate(): number {
  return exchangeRate;
}

// Initialize currency from localStorage on client side
export function initializeCurrency() {
  if (typeof window !== 'undefined') {
    const savedCurrency = localStorage.getItem('app-currency') as CurrencyCode;
    const savedRate = localStorage.getItem('app-exchange-rate');
    
    if (savedCurrency && CURRENCY_CONFIGS[savedCurrency]) {
      currentCurrency = savedCurrency;
      exchangeRate = savedRate ? parseFloat(savedRate) : CURRENCY_CONFIGS[savedCurrency].exchangeRate;
    }
  }
}

// Currency formatting functions
export function formatCurrency(
  amount: number | undefined | null,
  options?: {
    currency?: CurrencyCode;
    compact?: boolean;
    showSymbol?: boolean;
    locale?: string;
    minimumFractionDigits?: number;
    maximumFractionDigits?: number;
  }
): string {
  if (amount == null || isNaN(amount)) return '-';
  
  const currency = options?.currency ?? currentCurrency;
  const config = CURRENCY_CONFIGS[currency];
  const { 
    compact = false, 
    showSymbol = true, 
    locale = config.locale,
    minimumFractionDigits = config.decimalPlaces,
    maximumFractionDigits = config.decimalPlaces
  } = options || {};
  
  // Convert amount if needed (assuming stored values are in USD)
  const displayAmount = currency === 'USD' ? amount : amount * exchangeRate;
  
  if (compact && displayAmount >= 1000) {
    const compactValue = Intl.NumberFormat(locale, { 
      notation: 'compact', 
      maximumFractionDigits: 1 
    }).format(displayAmount);
    
    return showSymbol ? `${config.symbol}${compactValue}` : compactValue;
  }
  
  const formattedValue = Intl.NumberFormat(locale, {
    minimumFractionDigits,
    maximumFractionDigits
  }).format(displayAmount);
  
  return showSymbol ? `${config.symbol}${formattedValue}` : formattedValue;
}

// Parse currency string back to number (returns USD equivalent)
export function parseCurrency(value: string, fromCurrency?: CurrencyCode): number {
  const currency = fromCurrency ?? currentCurrency;
  const config = CURRENCY_CONFIGS[currency];
  
  // Remove currency symbol and parse
  const cleanValue = value.replace(new RegExp(`[^\\d.,-]`, 'g'), '');
  const parsed = parseFloat(cleanValue.replace(',', ''));
  
  if (isNaN(parsed)) return 0;
  
  // Convert back to USD equivalent
  return currency === 'USD' ? parsed : parsed / exchangeRate;
}

// Convert between currencies
export function convertCurrency(
  amount: number, 
  fromCurrency: CurrencyCode, 
  toCurrency: CurrencyCode
): number {
  if (fromCurrency === toCurrency) return amount;
  
  // Convert to USD first, then to target currency
  const usdAmount = fromCurrency === 'USD' ? amount : amount / CURRENCY_CONFIGS[fromCurrency].exchangeRate;
  return toCurrency === 'USD' ? usdAmount : usdAmount * CURRENCY_CONFIGS[toCurrency].exchangeRate;
}

// Compact number formatter (for charts and summaries)
export function formatCompactNumber(
  num: number, 
  currency?: CurrencyCode
): string {
  const config = CURRENCY_CONFIGS[currency ?? currentCurrency];
  const displayAmount = currency === 'USD' ? num : num * exchangeRate;
  
  if (displayAmount >= 1e12) {
    return `${config.symbol}${(displayAmount / 1e12).toFixed(1)}${config.compactNotation.trillion}`;
  }
  if (displayAmount >= 1e9) {
    return `${config.symbol}${(displayAmount / 1e9).toFixed(1)}${config.compactNotation.billion}`;
  }
  if (displayAmount >= 1e6) {
    return `${config.symbol}${(displayAmount / 1e6).toFixed(1)}${config.compactNotation.million}`;
  }
  if (displayAmount >= 1e3) {
    return `${config.symbol}${(displayAmount / 1e3).toFixed(1)}${config.compactNotation.thousand}`;
  }
  
  return formatCurrency(displayAmount, { currency, showSymbol: true });
}

// Utility functions for common formatting patterns
export function formatPrice(amount: number, currency?: CurrencyCode): string {
  return formatCurrency(amount, { currency, showSymbol: true });
}

export function formatAmount(amount: number, currency?: CurrencyCode): string {
  return formatCurrency(amount, { currency, showSymbol: true });
}

export function formatCompactAmount(amount: number, currency?: CurrencyCode): string {
  return formatCurrency(amount, { currency, showSymbol: true, compact: true });
}

// Backward compatibility helpers
export function formatUSD(amount: number): string {
  return formatCurrency(amount, { currency: 'USD', showSymbol: true });
}

export function formatIDR(amount: number): string {
  return formatCurrency(amount, { currency: 'IDR', showSymbol: true });
}

// Initialize currency on module load
if (typeof window !== 'undefined') {
  initializeCurrency();
} 