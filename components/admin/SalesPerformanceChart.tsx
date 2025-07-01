import { useSalesPerformance, SalesView } from '@/hooks/useSalesPerformance';
import { ResponsiveContainer, BarChart, Bar, CartesianGrid, XAxis, YAxis, Tooltip } from 'recharts';
import React, { useMemo } from 'react';

interface SalesPerformanceChartProps {
  year: number;
  view: SalesView;
}

export function SalesPerformanceChart({ year, view }: SalesPerformanceChartProps) {
  const { data, isLoading, error } = useSalesPerformance(year, view);

  const chartPadding = { top: 24, right: 24, left: 24, bottom: 24 };

  // Memoize skeleton data
  const skeletonData = useMemo(() => Array.from({ length: 6 }).map((_, i) => ({
    month: `M${i + 1}`,
    ...(view === 'city'
      ? { Jakarta: 0, Surabaya: 0, Bandung: 0 }
      : { product: 0 }),
  })), [view]);

  // Memoize chart data transformation
  const chartData = useMemo(() => {
    if (!data || data.length === 0) return [];
    
    if (view === 'city') {
      return data[0].monthlySales.map((_: any, i: number) => {
        const month = data[0].monthlySales[i].month;
        const entry: any = { month };
        data.forEach((cityData: any) => {
          entry[cityData.city] = cityData.monthlySales[i].totalSales;
        });
        return entry;
      });
    }
    
    return data;
  }, [data, view]);

  // Memoize cities and colors
  const { cities, colors } = useMemo(() => {
    const cities = data && data.length > 0
      ? Object.keys(data[0]).filter(key => key !== 'month')
      : ['Jakarta', 'Surabaya', 'Bandung'];
    const colors = ['#4f46e5', '#0ea5e9', '#10b981', '#f59e0b', '#ef4444'];
    return { cities, colors };
  }, [data]);

  if (error) {
    return (
      <div className="text-red-600 py-8 text-center">
        {error.message || 'Failed to load sales data. Please try again later.'}
      </div>
    );
  }

  if ((!data || data.length === 0) && !isLoading) {
    return (
      <div className="text-muted-foreground py-8 text-center">
        No sales data available for the selected period.
      </div>
    );
  }

  if (view === 'city') {
    return (
      <ResponsiveContainer width="100%" height={340}>
        <BarChart data={isLoading ? skeletonData : chartData} margin={{ ...chartPadding, bottom: 48 }} barCategoryGap={16}>
          <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
          <XAxis dataKey="month" stroke="#888" fontSize={15} fontWeight={600} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={48} />
          <YAxis stroke="#888" fontSize={15} fontWeight={600} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
          <Tooltip />
          {cities.map((city, idx) => (
            <Bar
              key={city}
              dataKey={city}
              fill={colors[idx % colors.length]}
              fillOpacity={isLoading ? 0.3 : 1}
              isAnimationActive={!isLoading}
            />
          ))}
        </BarChart>
      </ResponsiveContainer>
    );
  }

  return (
    <ResponsiveContainer width="100%" height={340}>
      <BarChart data={isLoading ? skeletonData : chartData} margin={{ ...chartPadding, bottom: 48 }} barCategoryGap={16}>
        <CartesianGrid strokeDasharray="3 3" stroke="#e5e7eb" />
        <XAxis dataKey="month" stroke="#888" fontSize={15} fontWeight={600} tickLine={false} axisLine={false} angle={-30} textAnchor="end" height={48} />
        <YAxis stroke="#888" fontSize={15} fontWeight={600} tickLine={false} axisLine={false} tickFormatter={v => `$${v}`} />
        <Tooltip />
        <Bar
          dataKey="product"
          fill="#8884d8"
          fillOpacity={isLoading ? 0.3 : 1}
          isAnimationActive={!isLoading}
        />
      </BarChart>
    </ResponsiveContainer>
  );
} 