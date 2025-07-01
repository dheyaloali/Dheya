"use client";

import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { useCurrencyAdmin } from '@/components/providers/currency-provider';
import { useToast } from '@/components/ui/use-toast';
import { DollarSign, Settings, RefreshCw, Save, Loader2 } from 'lucide-react';

export function CurrencySettings() {
  const { 
    currentCurrency, 
    currentConfig, 
    exchangeRate, 
    setCurrency, 
    updateExchangeRate, 
    availableCurrencies, 
    currencyConfigs,
    formatCurrency,
    isLoading
  } = useCurrencyAdmin();
  
  // Show loading state while currency data is loading
  if (isLoading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="flex flex-col items-center gap-2">
          <Loader2 className="h-8 w-8 text-primary animate-spin" />
          <span className="text-sm text-muted-foreground">Loading currency settings...</span>
        </div>
      </div>
    );
  }
  
  const { toast } = useToast();
  
  const [selectedCurrency, setSelectedCurrency] = useState<typeof currentCurrency>(currentCurrency);
  const [customExchangeRate, setCustomExchangeRate] = useState<string>(exchangeRate.toString());
  const [isUpdating, setIsUpdating] = useState(false);

  // Sample amounts for preview
  const sampleAmounts = [100, 1000, 10000, 100000, 1000000];

  const handleCurrencyChange = (currency: typeof currentCurrency) => {
    setSelectedCurrency(currency);
    setCustomExchangeRate(currencyConfigs[currency].exchangeRate.toString());
  };

  const handleSaveSettings = async () => {
    setIsUpdating(true);
    
    try {
      const rate = parseFloat(customExchangeRate);
      if (isNaN(rate) || rate <= 0) {
        throw new Error('Exchange rate must be a positive number');
      }
      
      // Get currency config for the selected currency
      const selectedConfig = currencyConfigs[selectedCurrency];
      
      // Save to database via settings API
      const response = await fetch('/api/admin/settings', {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          defaultCurrency: selectedCurrency,
          exchangeRate: rate,
          currencySymbol: selectedConfig.symbol,
          currencyCode: selectedCurrency,
          currencyName: selectedConfig.name,
          currencyLocale: selectedConfig.locale,
        }),
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || 'Failed to save currency settings');
      }
      
      // Update local state
      setCurrency(selectedCurrency, rate);
      
      toast({
        title: "Currency settings updated",
        description: `Switched to ${selectedConfig.name} with exchange rate ${rate}`,
        variant: "default",
      });
    } catch (error) {
      toast({
        title: "Error updating currency",
        description: error instanceof Error ? error.message : "Failed to update currency settings",
        variant: "destructive",
      });
    } finally {
      setIsUpdating(false);
    }
  };

  const handleResetToDefault = () => {
    const defaultRate = currencyConfigs[selectedCurrency].exchangeRate;
    setCustomExchangeRate(defaultRate.toString());
  };

  return (
    <div className="space-y-6">
      {/* Current Settings */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <DollarSign className="h-5 w-5" />
            Current Currency Settings
          </CardTitle>
          <CardDescription>
            Manage the application's currency display and exchange rates
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <Label>Current Currency</Label>
              <div className="flex items-center gap-2 mt-1">
                <Badge variant="outline" className="text-lg">
                  {currentConfig.symbol} {currentCurrency}
                </Badge>
                <span className="text-sm text-muted-foreground">
                  {currentConfig.name}
                </span>
              </div>
            </div>
            
            <div>
              <Label>Exchange Rate</Label>
              <div className="text-lg font-semibold mt-1">
                1 USD = {exchangeRate.toLocaleString()} {currentCurrency}
              </div>
            </div>
            
            <div>
              <Label>Locale</Label>
              <div className="text-sm text-muted-foreground mt-1">
                {currentConfig.locale}
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Currency Configuration */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="h-5 w-5" />
            Change Currency Settings
          </CardTitle>
          <CardDescription>
            Select a new currency and set the exchange rate
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="currency-select">Currency</Label>
              <Select value={selectedCurrency} onValueChange={handleCurrencyChange}>
                <SelectTrigger id="currency-select">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {availableCurrencies.map((currency) => (
                    <SelectItem key={currency} value={currency}>
                      <div className="flex items-center gap-2">
                        <span>{currencyConfigs[currency].symbol}</span>
                        <span>{currency}</span>
                        <span className="text-muted-foreground">
                          ({currencyConfigs[currency].name})
                        </span>
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            <div>
              <Label htmlFor="exchange-rate">Exchange Rate (1 USD = X {selectedCurrency})</Label>
              <div className="flex gap-2 mt-1">
                <Input
                  id="exchange-rate"
                  type="number"
                  value={customExchangeRate}
                  onChange={(e) => setCustomExchangeRate(e.target.value)}
                  placeholder="Enter exchange rate"
                  min="0.01"
                  step="0.01"
                />
                <Button 
                  variant="outline" 
                  size="icon"
                  onClick={handleResetToDefault}
                  title="Reset to default"
                >
                  <RefreshCw className="h-4 w-4" />
                </Button>
              </div>
              <p className="text-xs text-muted-foreground mt-1">
                Default: {currencyConfigs[selectedCurrency].exchangeRate.toLocaleString()}
              </p>
            </div>
          </div>
          
          <Separator />
          
          <div className="flex justify-end gap-2">
            <Button 
              onClick={handleSaveSettings} 
              disabled={isUpdating}
              className="flex items-center gap-2"
            >
              <Save className="h-4 w-4" />
              {isUpdating ? "Updating..." : "Save Settings"}
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Preview */}
      <Card>
        <CardHeader>
          <CardTitle>Currency Preview</CardTitle>
          <CardDescription>
            See how amounts will be displayed in the selected currency
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {sampleAmounts.map((amount) => (
              <div key={amount} className="border rounded-lg p-3">
                <div className="text-sm text-muted-foreground">USD {amount.toLocaleString()}</div>
                <div className="text-lg font-semibold">
                  {formatCurrency(amount, { currency: selectedCurrency })}
                </div>
                <div className="text-xs text-muted-foreground">
                  Compact: {formatCurrency(amount, { currency: selectedCurrency, compact: true })}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>

      {/* Currency Information */}
      <Card>
        <CardHeader>
          <CardTitle>Currency Information</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            {availableCurrencies.map((currency) => {
              const config = currencyConfigs[currency];
              return (
                <div key={currency} className="space-y-2">
                  <div className="flex items-center gap-2">
                    <Badge variant={currency === currentCurrency ? "default" : "outline"}>
                      {config.symbol} {currency}
                    </Badge>
                    {currency === currentCurrency && (
                      <Badge variant="secondary">Active</Badge>
                    )}
                  </div>
                  <div className="text-sm space-y-1">
                    <div><strong>Name:</strong> {config.name}</div>
                    <div><strong>Locale:</strong> {config.locale}</div>
                    <div><strong>Decimal Places:</strong> {config.decimalPlaces}</div>
                    <div><strong>Default Rate:</strong> 1 USD = {config.exchangeRate.toLocaleString()} {currency}</div>
                    <div><strong>Compact Notation:</strong></div>
                    <div className="text-xs text-muted-foreground ml-2">
                      Thousand: {config.compactNotation.thousand} | 
                      Million: {config.compactNotation.million} | 
                      Billion: {config.compactNotation.billion} | 
                      Trillion: {config.compactNotation.trillion}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
    </div>
  );
} 