"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { useCurrencyAdmin } from '@/components/providers/currency-provider';
import { useToast } from '@/components/ui/use-toast';
import { DollarSign, ChevronDown, Loader2 } from 'lucide-react';

export function CurrencySwitcher() {
  const { 
    currentCurrency, 
    currentConfig, 
    setCurrency, 
    availableCurrencies, 
    currencyConfigs,
    isLoading 
  } = useCurrencyAdmin();
  
  // Show loading state while currency data is loading
  if (isLoading) {
    return (
      <div className="flex items-center gap-2">
        <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />
        <span className="text-xs text-muted-foreground">Loading...</span>
      </div>
    );
  }
  
  const { toast } = useToast();
  const [isChanging, setIsChanging] = useState(false);

  const handleCurrencyChange = async (currency: typeof currentCurrency) => {
    if (currency === currentCurrency) return;
    
    setIsChanging(true);
    
    try {
      setCurrency(currency);
      
      toast({
        title: "Currency changed",
        description: `Switched to ${currencyConfigs[currency].name}`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error changing currency",
        description: "Failed to change currency",
        variant: "destructive",
      });
    } finally {
      setIsChanging(false);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <DollarSign className="h-4 w-4 text-muted-foreground" />
      
      <Select 
        value={currentCurrency} 
        onValueChange={handleCurrencyChange}
        disabled={isChanging}
      >
        <SelectTrigger className="w-32 h-8">
          <SelectValue>
            <div className="flex items-center gap-1">
              <span className="text-sm font-medium">{currentConfig.symbol}</span>
              <span className="text-xs text-muted-foreground">{currentCurrency}</span>
            </div>
          </SelectValue>
        </SelectTrigger>
        <SelectContent>
          {availableCurrencies.map((currency) => {
            const config = currencyConfigs[currency];
            return (
              <SelectItem key={currency} value={currency}>
                <div className="flex items-center gap-2">
                  <span className="font-medium">{config.symbol}</span>
                  <span>{currency}</span>
                  <Badge variant="outline" className="text-xs">
                    {config.name}
                  </Badge>
                </div>
              </SelectItem>
            );
          })}
        </SelectContent>
      </Select>
      
      {isChanging && (
        <div className="h-4 w-4 animate-spin rounded-full border-2 border-gray-300 border-t-blue-600" />
      )}
    </div>
  );
} 