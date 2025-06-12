"use client"

import React from 'react'
import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Download, TrendingUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Progress } from "@/components/ui/progress"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { RecordSaleDialog } from "@/components/ui/employee/Record-sale-dialog"
import { ChartContainer } from "@/components/ui/chart"
import { Area, AreaChart, CartesianGrid, Tooltip, XAxis, YAxis, ResponsiveContainer } from "recharts"
import useSWR from 'swr'
import * as XLSX from 'xlsx'
import { Select, SelectTrigger, SelectContent, SelectItem, SelectValue } from "@/components/ui/select"
import { PaginationControls } from "@/components/pagination-controls"
import { useTranslations } from "next-intl"

const fetcher = (url: string) => fetch(url).then(res => res.json())

// Add a utility function for compact currency formatting:
function formatCompactCurrency(value: number | undefined) {
  if (value == null) return '-';
  return value >= 1000
    ? `$${Intl.NumberFormat('en', { notation: 'compact', maximumFractionDigits: 1 }).format(value)}`
    : `$${value}`;
}

export function EmployeeSalesContent() {
  const t = useTranslations('Sales');
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState<number>(now.getMonth());
  const [selectedYear, setSelectedYear] = useState<number>(now.getFullYear());
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const { data, mutate, isLoading } = useSWR(`/api/employee/sales?page=${page}&pageSize=${pageSize}&month=${selectedMonth + 1}&year=${selectedYear}`, fetcher);
  const salesData = data?.sales || [];
  const total = data?.total || 0;
  const totalPages = data?.totalPages || 1;
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  const { data: assignedProductsData } = useSWR('/api/employee/sales/assigned-products', fetcher)
  const assignedProducts = assignedProductsData?.products || []
  const [selectedProductId, setSelectedProductId] = useState<string>("all")
  const monthlyTarget = data?.target;
  const months = [
    "January", "February", "March", "April", "May", "June",
    "July", "August", "September", "October", "November", "December"
  ];
  // Years from 2020 to 2050
  const years = Array.from({ length: 2050 - 2020 + 1 }, (_, i) => 2020 + i);

  // Calculate monthly sales
  const monthlySales = React.useMemo(() => {
    if (!salesData) return 0
    const now = new Date()
    return salesData.filter((item: any) => {
      const date = new Date(item.date)
      return date.getMonth() === now.getMonth() && date.getFullYear() === now.getFullYear()
    }).reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
  }, [salesData])

  // Filtered sales data by product, month, and year
  const filteredSalesData = React.useMemo(() => {
    if (!salesData) return [];
    return salesData.filter((item: any) => {
      const date = new Date(item.date);
      const matchesProduct = selectedProductId === "all" || String(item.product?.id) === selectedProductId;
      const matchesMonth = date.getMonth() === selectedMonth;
      const matchesYear = date.getFullYear() === selectedYear;
      return matchesProduct && matchesMonth && matchesYear;
    });
  }, [salesData, selectedProductId, selectedMonth, selectedYear]);

  // Sort filteredSalesData by date descending before rendering
  const sortedSalesData = React.useMemo(() => {
    if (!filteredSalesData) return [];
    return [...filteredSalesData].sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
  }, [filteredSalesData]);

  // Cumulative sales for the selected month/year
  const daysInMonth = new Date(selectedYear, selectedMonth + 1, 0).getDate();
  const cumulativeChartData = React.useMemo(() => {
    if (!filteredSalesData) return [];
    let runningTotal = 0;
    return Array.from({ length: daysInMonth }, (_, i) => {
      const day = i + 1;
      // Find all assignments for this day
      const assignmentsForDay = salesData
        .filter((sale: any) => {
          const d = new Date(sale.date);
          return d.getDate() === day && sale.assignment;
        })
        .map((sale: any) => sale.assignment);
      // Count statuses
      const soldCount = assignmentsForDay.filter((a: any) => a.status === 'sold').length;
      const partiallySoldCount = assignmentsForDay.filter((a: any) => a.status === 'partially_sold').length;
      const expiredCount = assignmentsForDay.filter((a: any) => a.status === 'expired').length;
      const daySales = filteredSalesData.filter((item: any) => {
        const d = new Date(item.date);
        return d.getDate() === day;
      }).reduce((sum: number, item: any) => sum + (item.amount || 0), 0);
      runningTotal += daySales;
      return {
        date: String(day),
        sales: runningTotal,
        target: monthlyTarget ?? 0,
        soldCount,
        partiallySoldCount,
        expiredCount,
      };
    });
  }, [filteredSalesData, salesData, monthlyTarget, daysInMonth]);

  // Analytics
  const bestSellingProduct = React.useMemo(() => {
    if (!salesData) return null
    const productTotals: Record<string, number> = {}
    salesData.forEach((sale: any) => {
      const pid = sale.product?.id
      if (!pid) return
      productTotals[pid] = (productTotals[pid] || 0) + (sale.amount || 0)
    })
    const bestId = Object.entries(productTotals).sort((a, b) => b[1] - a[1])[0]?.[0]
    return assignedProducts.find((p: any) => String(p.id) === String(bestId))?.name || null
  }, [salesData, assignedProducts])
  const transactionCount = filteredSalesData.length
  const averageSale = filteredSalesData.length > 0 ? (filteredSalesData.reduce((sum: number, s: any) => sum + (s.amount || 0), 0) / filteredSalesData.length) : 0
  // Last month comparison
  const lastMonthSales = React.useMemo(() => {
    if (!salesData) return 0
    const now = new Date()
    const lastMonth = new Date(now.getFullYear(), now.getMonth() - 1, 1)
    return salesData.filter((item: any) => {
      const date = new Date(item.date)
      return date.getMonth() === lastMonth.getMonth() && date.getFullYear() === lastMonth.getFullYear()
      }).reduce((sum: number, item: any) => sum + (item.amount || 0), 0)
  }, [salesData])

  const handleExport = () => {
    if (!salesData || salesData.length === 0) return;
    const exportData = salesData.map((sale: any) => ({
      Customer: sale.customer?.name || '',
      Product: sale.product?.name || '',
      Date: sale.date ? format(new Date(sale.date), 'MMM dd, yyyy') : '',
      Quantity: sale.quantity,
      Amount: sale.amount,
    }));
    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Sales');
    XLSX.writeFile(wb, 'my_sales.xlsx');
  };

  // Reset page if filter changes
  useEffect(() => { setPage(1); }, [selectedProductId, selectedMonth, selectedYear, pageSize]);

  return (
    <div className="w-full p-4 md:p-6 pb-20 pt-4 md:pt-0">
      <div className="sticky top-0 bg-background z-10 pt-4 pb-4 mb-4 border-b w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('sales')}</h1>
            <p className="text-muted-foreground">{t('trackSalesPerformance')}</p>
          </div>

          <div className="flex gap-2">
            <Button
              className="bg-black text-white hover:bg-gray-900 gap-2"
              onClick={() => {
                if (!sortedSalesData || sortedSalesData.length === 0) return;
                const exportData = sortedSalesData.map((sale: any) => ({
                  Product: sale.product?.name || '',
                  Description: sale.product?.description || '',
                  Price: sale.product?.price || '',
                  "Quantity Sold": sale.quantity || '',
                  Assigned: sale.assignment?.quantity || '',
                  Status: sale.assignment?.status || '',
                  Amount: sale.amount || '',
                  Date: sale.date ? format(new Date(sale.date), 'MMM dd, yyyy') : '',
                }));
                const ws = XLSX.utils.json_to_sheet(exportData);
                const wb = XLSX.utils.book_new();
                XLSX.utils.book_append_sheet(wb, ws, 'Recent Sales');
                XLSX.writeFile(wb, 'recent_sales.xlsx');
              }}
            >
              <Download className="h-4 w-4" />
              {t('export')}
            </Button>
          </div>
        </div>
      </div>

      {/* Sales performance card */}
      <Card className="mb-6 max-w-4xl mx-auto">
        <CardHeader>
          <CardTitle>{t('salesPerformance')}</CardTitle>
          <CardDescription>{t('salesPerformanceDescription')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-6 w-full">
            <div className="md:w-1/3 w-full">
              <div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{t('monthlySales')}</span>
                  {isLoading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : (
                    <span className="text-sm text-muted-foreground">{formatCompactCurrency(monthlySales)}</span>
                  )}
                </div>
                <div className="flex items-center justify-between mb-1">
                  <span className="text-sm font-medium">{t('monthlyTarget')}</span>
                  {isLoading ? (
                    <Skeleton className="h-5 w-20" />
                  ) : monthlyTarget == null ? (
                    <span className="text-sm text-muted-foreground italic">{t('noTargetSet')}</span>
                  ) : (
                    <span className="text-sm text-muted-foreground">{formatCompactCurrency(monthlyTarget)}</span>
                  )}
                </div>
                {isLoading ? (
                  <Skeleton className="h-2 w-full mt-2" />
                ) : monthlyTarget == null ? (
                  <div className="h-2 w-full mt-2 bg-muted rounded" />
                ) : (
                  <Progress value={(monthlySales / monthlyTarget) * 100} className="h-2" />
                )}
              </div>
            </div>
            <div className="md:w-2/3 w-full">
              <div>
                <div className="flex items-center gap-2 mb-2">
                  <TrendingUp className="h-4 w-4 text-green-500" />
                  <h4 className="font-medium">{t('performanceInsights')}</h4>
                </div>
                {isLoading ? (
                  <div className="space-y-2">
                    <Skeleton className="h-4 w-full" />
                    <Skeleton className="h-4 w-3/4" />
                    <Skeleton className="h-4 w-5/6" />
                  </div>
                ) : monthlyTarget == null ? (
                  <div className="space-y-2 text-sm italic text-muted-foreground">
                    {t('noTargetSetForMonth')}
                  </div>
                ) : (
                  <div className="space-y-2 text-sm">
                    <p>
                      {t('youveReached', { percent: Math.round((monthlySales / monthlyTarget) * 100) })}
                    </p>
                    <p>
                      {t('dailyAverage')}
                      <span className="font-medium">
                        {formatCompactCurrency(Math.round(monthlySales / new Date().getDate()))}
                      </span>
                      .
                    </p>
                    <p>{t('keepUpGoodWork')}</p>
                  </div>
                )}
              </div>
            </div>
                </div>
          <div className="md:w-2/3 w-full mt-4">
            <div className="flex justify-end gap-4 mb-2">
                    <Select value={String(selectedMonth)} onValueChange={v => setSelectedMonth(Number(v))}>
                      <SelectTrigger className="w-40">
                        <SelectValue placeholder="Month" />
                      </SelectTrigger>
                      <SelectContent>
                        {months.map((m, i) => (
                          <SelectItem key={i} value={String(i)}>{m}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <Select value={String(selectedYear)} onValueChange={v => setSelectedYear(Number(v))}>
                      <SelectTrigger className="w-32">
                        <SelectValue placeholder="Year" />
                      </SelectTrigger>
                      <SelectContent>
                        {years.map((y) => (
                          <SelectItem key={y} value={String(y)}>{y}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
            <ResponsiveContainer width="100%" height={400}>
              <AreaChart data={cumulativeChartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="date" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} tickMargin={8} tickFormatter={formatCompactCurrency} />
                    <Tooltip
                  content={({ active, payload, label }) => {
                    if (!active || !payload || !payload.length) return null;
                    const data = payload[0].payload;
                    return (
                      <div className="p-2 bg-white rounded shadow text-xs">
                        <div><b>{t('date')}:</b> {label}</div>
                        <div className="flex items-center gap-1 mt-2 mb-1">
                          <span className="inline-flex items-center gap-1"><span role="img" aria-label="sold">✅</span> <b>{t('sold')}:</b> {data.soldCount}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-1">
                          <span className="inline-flex items-center gap-1"><span role="img" aria-label="partially sold">🟡</span> <b>{t('partiallySold')}:</b> {data.partiallySoldCount}</span>
                        </div>
                        <div className="flex items-center gap-1 mb-2">
                          <span className="inline-flex items-center gap-1"><span role="img" aria-label="expired">❌</span> <b>{t('expired')}:</b> {data.expiredCount}</span>
                        </div>
                        <div><b>{t('sales')}:</b> {formatCompactCurrency(data.sales)}</div>
                        <div><b>{t('target')}:</b> {formatCompactCurrency(data.target)}</div>
                      </div>
                    );
                  }}
                    />
                    <Area
                      type="monotone"
                      dataKey="sales"
                      stroke="var(--color-sales)"
                      fill="var(--color-sales)"
                      fillOpacity={0.2}
                    />
                        <Area
                          type="monotone"
                          dataKey="target"
                          stroke="#eab308"
                          fill="#eab308"
                          fillOpacity={0.1}
                        />
                  </AreaChart>
            </ResponsiveContainer>
          </div>
        </CardContent>
      </Card>

      {/* Recent sales table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('recentSales')}</CardTitle>
          <CardDescription>{t('recentSalesDesc')}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border overflow-x-auto max-w-full" style={{ maxWidth: '100vw' }}>
            <Table className="min-w-[900px]">
              <TableHeader>
                <TableRow>
                  <TableHead>{t('product')}</TableHead>
                  <TableHead>{t('description')}</TableHead>
                  <TableHead>{t('price')}</TableHead>
                  <TableHead>{t('quantitySold')}</TableHead>
                  <TableHead>{t('assigned')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('amount')}</TableHead>
                  <TableHead>{t('date')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <Skeleton className="h-10 w-10 rounded-md" />
                            <Skeleton className="h-4 w-32" />
                          </div>
                        </TableCell>
                        <TableCell><Skeleton className="h-4 w-32" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-10" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-16" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-4 w-24" /></TableCell>
                      </TableRow>
                    ))
                  : sortedSalesData.map((sale: any, index: number) => (
                      <TableRow key={index}>
                        <TableCell>
                          <div className="flex items-center gap-3">
                            <img
                              src={sale.product?.imageUrl || sale.product?.image || "/placeholder.svg"}
                              alt={sale.product?.name || "Product"}
                              className="h-10 w-10 rounded-md object-cover"
                            />
                            <span>{sale.product?.name || ""}</span>
                          </div>
                        </TableCell>
                        <TableCell>{sale.product?.description || '-'}</TableCell>
                        <TableCell className="text-black">{formatCompactCurrency(sale.product?.price)}</TableCell>
                        <TableCell>
                          <span className="inline-block bg-blue-100 text-black px-3 py-1 text-xs rounded-md">
                            {sale.quantity || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-block bg-blue-100 text-black px-3 py-1 text-xs rounded-md">
                            {sale.assignment?.quantity || "-"}
                          </span>
                        </TableCell>
                        <TableCell>
                          <span className="inline-block bg-blue-100 text-black font-semibold px-3 py-1 text-xs rounded-md">
                            {sale.assignment?.status || '-'}
                          </span>
                        </TableCell>
                        <TableCell className="text-black">{formatCompactCurrency(sale.amount)}</TableCell>
                        <TableCell>{format(new Date(sale.date), "MMM dd, yyyy")}</TableCell>
                      </TableRow>
                    ))}
              </TableBody>
            </Table>
          </div>
          <PaginationControls
            page={page}
            setPage={setPage}
            totalPages={totalPages}
            pageSize={pageSize}
            setPageSize={setPageSize}
            total={total}
            from={from}
            to={to}
          />
        </CardContent>
      </Card>
    </div>
  )
}
