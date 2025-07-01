import { CurrencySettings } from '@/components/admin/currency-settings';
import { Metadata } from 'next';

export const metadata: Metadata = {
  title: 'Currency Settings - Admin Dashboard',
  description: 'Manage application currency settings and exchange rates',
};

export default function CurrencySettingsPage() {
  return (
    <div className="container mx-auto py-6">
      <div className="mb-6">
        <h1 className="text-3xl font-bold">Currency Settings</h1>
        <p className="text-muted-foreground">
          Configure the application's currency display and exchange rates
        </p>
      </div>
      
      <CurrencySettings />
    </div>
  );
} 