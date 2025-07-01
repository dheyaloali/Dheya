"use client"

import { useState } from "react"
import { Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis, CartesianGrid } from "recharts"
import { format, parse } from "date-fns"
import useSWR from 'swr'
import { useCurrency } from "@/components/providers/currency-provider"

const cities = ["All", "Jakarta", "Bandung", "Surabaya"];
const statuses = ["All", "Active", "Inactive"];

const fetcher = (url: string) => fetch(url).then(res => res.json());

export function SalaryTrendsChart() {
  const { formatAmount } = useCurrency();
  const [dateRange, setDateRange] = useState<{ start: string; end: string }>(() => {
    const now = new Date();
    const start = new Date(now.getFullYear(), now.getMonth() - 11, 1);
    return {
      start: start.toISOString().slice(0, 10),
      end: now.toISOString().slice(0, 10),
    }
  })
  const [city, setCity] = useState("All")
  const [status, setStatus] = useState("All")
  const [groupBy, setGroupBy] = useState<'month'|'year'>('month')

  const params = new URLSearchParams({
    start: dateRange.start,
    end: dateRange.end,
    groupBy,
  });
  if (city !== "All") params.append("city", city);
  if (status !== "All") params.append("status", status);
  const swrKey = `/api/salaries/trends?${params.toString()}`;

  const { data, isLoading } = useSWR(swrKey, fetcher);

  return (
    <div>
      <div className="flex flex-wrap gap-4 mb-4 items-end">
        <div className="min-w-[180px]">
          <label className="block text-xs font-medium mb-1">Date Range</label>
          <input
            type="date"
            value={dateRange.start}
            max={dateRange.end}
            onChange={e => setDateRange(r => ({ ...r, start: e.target.value }))}
            className="border rounded px-2 py-1 text-xs mr-2"
          />
          <input
            type="date"
            value={dateRange.end}
            min={dateRange.start}
            onChange={e => setDateRange(r => ({ ...r, end: e.target.value }))}
            className="border rounded px-2 py-1 text-xs"
          />
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium mb-1">City</label>
          <select value={city} onChange={e => setCity(e.target.value)} className="border rounded px-2 py-1 text-xs w-full">
            {cities.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium mb-1">Employee Status</label>
          <select value={status} onChange={e => setStatus(e.target.value)} className="border rounded px-2 py-1 text-xs w-full">
            {statuses.map(s => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="min-w-[140px]">
          <label className="block text-xs font-medium mb-1">Granularity</label>
          <select value={groupBy} onChange={e => setGroupBy(e.target.value as 'month'|'year')} className="border rounded px-2 py-1 text-xs w-full">
            <option value="month">Monthly</option>
            <option value="year">Yearly</option>
          </select>
        </div>
      </div>
      {isLoading ? (
        <div className="h-[350px] flex items-center justify-center text-muted-foreground text-lg">
          Loading salary trends...
        </div>
      ) : !data || data.length === 0 ? (
        <div className="h-[350px] flex items-center justify-center text-muted-foreground text-lg">
          No salary data for the selected range.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={350}>
          <LineChart data={data} margin={{ left: 16, right: 16, top: 16, bottom: 16 }}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis
              dataKey="period"
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={period => {
                if (groupBy === "year") return period;
                if (/^\d{4}-\d{2}$/.test(period)) {
                  try {
                    return format(parse(period, "yyyy-MM", new Date()), "MMM yyyy");
                  } catch {
                    return period;
                  }
                }
                return period;
              }}
            />
            <YAxis
              stroke="#888888"
              fontSize={12}
              tickLine={false}
              axisLine={false}
              tickFormatter={(value) =>
                typeof value === "number" ? formatAmount(value) : value
              }
            />
            <Tooltip
              formatter={(value, name) => [
                typeof value === "number" ? `$${value.toLocaleString()}` : value,
                name === "amount" ? "Total Paid" : name
              ]}
              labelFormatter={label => {
                if (groupBy === "year") return `Year: ${label}`;
                if (/^\d{4}-\d{2}$/.test(label)) {
                  try {
                    return `Month: ${format(parse(label, "yyyy-MM", new Date()), "MMM yyyy")}`;
                  } catch {
                    return `Month: ${label}`;
                  }
                }
                return `Month: ${label}`;
              }}
            />
            <Line type="monotone" strokeWidth={2} dataKey="amount" stroke="#4f46e5" name="Total Paid" />
          </LineChart>
        </ResponsiveContainer>
      )}
    </div>
  )
} 