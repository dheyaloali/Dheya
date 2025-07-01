import { useCurrency } from '@/components/providers/currency-provider';

export function useCurrencyFormat() {
  const { 
    formatCurrency, 
    parseCurrency, 
    formatPrice, 
    formatAmount, 
    formatCompactAmount,
    currentCurrency,
    currentConfig 
  } = useCurrency();
  
  return {
    // Core formatting functions
    formatCurrency,
    parseCurrency,
    formatPrice,
    formatAmount,
    formatCompactAmount,
    
    // Current currency state
    currentCurrency,
    currentConfig,
    
    // Backward compatibility helpers
    formatUSD: (amount: number) => formatCurrency(amount, { currency: 'USD', showSymbol: true }),
    formatIDR: (amount: number) => formatCurrency(amount, { currency: 'IDR', showSymbol: true }),
    
    // Legacy format functions (for gradual migration)
    formatCompactCurrency: (value: number | undefined) => {
      if (value == null) return '-';
      return formatCurrency(value, { showSymbol: true, compact: true });
    },
    
    // Utility for conditional formatting
    formatMoney: (amount: number, options?: { compact?: boolean; showSymbol?: boolean }) => {
      return formatCurrency(amount, {
        showSymbol: options?.showSymbol ?? true,
        compact: options?.compact ?? false
      });
    }
  };
} 