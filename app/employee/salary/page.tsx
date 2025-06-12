"use client";

import { useState, useEffect } from "react";
import useSWR, { mutate } from "swr";
import { useTranslations } from "next-intl";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { FaMoneyBillWave, FaClock, FaGift, FaMinusCircle, FaCalculator } from 'react-icons/fa';
import { MdOutlineReceiptLong } from 'react-icons/md';

// Define a fetcher function
const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function EmployeeSalaryPage() {
  // Get translations
  const t = useTranslations('Salary');

  // State management
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [fromDate, setFromDate] = useState("");
  const [toDate, setToDate] = useState("");
  const [showBreakdown, setShowBreakdown] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Build query params
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("pageSize", String(pageSize));
  if (fromDate) params.append("fromDate", fromDate);
  if (toDate) params.append("toDate", toDate);

  // Prefetch salary data on mount for instant experience
  useEffect(() => {
    mutate(`/api/employee/salaries?${params.toString()}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // SWR fetch
  const { data, isLoading } = useSWR(
    `/api/employee/salaries?${params.toString()}`,
    fetcher,
    {
      onError: () => setError(t('noData')),
      keepPreviousData: true,
    }
  );
  
  const records = data?.salaries || [];
  const total = data?.total || 0;
  const totalPages = Math.ceil(total / pageSize);

  // Export handler (stub)
  const handleExport = () => {
    // Implement export to Excel logic here
  };

  // Loading state
  if (isLoading) {
    return (
      <div className="w-full p-4 md:p-6 pb-20 pt-4 md:pt-0">
        <Skeleton className="h-8 w-64 mb-4" />
        <Skeleton className="h-48 w-full mb-6" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 pb-20 pt-4 md:pt-0">
      <div className="sticky top-0 bg-background z-10 pt-4 pb-4 mb-4 border-b w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('salaryInformation')}</h1>
          </div>
        </div>
      </div>
      
      {/* Current Salary Card */}
      <Card className="mb-6">
        <CardHeader>
          <CardTitle><span className="flex items-center gap-2">$ {t('currentSalary')}</span></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row gap-8">
            <div className="flex-1">
              <div className="text-muted-foreground text-sm">{t('totalAmount')}</div>
              <div className="text-lg">{data?.currentSalary?.amount ? `$${data.currentSalary.amount}` : t('noData')}</div>
            </div>
            <div className="flex-1">
              <div className="text-muted-foreground text-sm">{t('paymentStatus')}</div>
              <div className="text-lg">{data?.currentSalary?.status || t('noData')}</div>
            </div>
            <div className="flex-1">
              <div className="text-muted-foreground text-sm">{t('paymentDate')}</div>
              <div className="text-lg">{data?.currentSalary?.payDate ? new Date(data.currentSalary.payDate).toLocaleDateString() : t('noData')}</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Salary History Card */}
      <Card>
        <CardHeader>
          <CardTitle><span className="flex items-center gap-2">🗓 {t('salaryHistory')}</span></CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex flex-col md:flex-row justify-between gap-4 mb-4">
            <div className="flex gap-2">
              <Input
                type="date"
                value={fromDate}
                onChange={(e) => setFromDate(e.target.value)}
                placeholder={t('from')}
              />
              <Input
                type="date"
                value={toDate}
                onChange={(e) => setToDate(e.target.value)}
                placeholder={t('to')}
              />
            </div>
            <Button onClick={handleExport}>{t('exportToExcel')}</Button>
          </div>
          
          {error ? (
            <div className="text-red-500 text-xs">{t('noData')}</div>
          ) : (
            <div className="space-y-4">
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr>
                      <th className="text-center font-medium text-sm text-muted-foreground align-middle">{t('period')}</th>
                      <th className="text-center font-medium text-sm text-muted-foreground align-middle">{t('baseSalary')}</th>
                      <th className="text-center font-medium text-sm text-muted-foreground align-middle">{t('overtime')}</th>
                      <th className="text-center font-medium text-sm text-muted-foreground align-middle">{t('bonuses')}</th>
                      <th className="text-center font-medium text-sm text-muted-foreground align-middle">{t('deductions')}</th>
                      <th className="text-center font-medium text-sm text-muted-foreground align-middle">{t('totalAmount')}</th>
                      <th className="text-center font-medium text-sm text-muted-foreground align-middle">{t('status')}</th>
                      <th className="text-center font-medium text-sm text-muted-foreground align-middle">{t('actions')}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {records.length === 0 ? (
                      <tr>
                        <td colSpan={8} className="text-center text-muted-foreground py-8">{t('noRecords')}</td>
                      </tr>
                    ) : records.map((record: any) => (
                      <tr key={record.id}>
                        <td className="text-center align-middle text-sm">{record.startDate && record.endDate ? `${new Date(record.startDate).toLocaleDateString()} - ${new Date(record.endDate).toLocaleDateString()}` : '-'}</td>
                        <td className="text-center align-middle text-sm">${record.metadata?.baseSalary?.toLocaleString?.() ?? '-'}</td>
                        <td className="text-center align-middle text-sm">${record.metadata?.overtimeBonus?.toLocaleString?.() ?? '-'}</td>
                        <td className="text-center align-middle text-sm">${record.metadata?.bonuses?.toLocaleString?.() ?? '-'}</td>
                        <td className="text-center align-middle text-sm">-${record.metadata?.deductions?.toLocaleString?.() ?? '-'}</td>
                        <td className="text-center align-middle text-sm">${record.metadata?.totalAmount?.toLocaleString?.() ?? record.amount?.toLocaleString?.() ?? '-'}</td>
                        <td className="text-center align-middle text-sm">{record.status}</td>
                        <td className="text-center align-middle">
                          <button
                            onClick={() => setShowBreakdown(true)}
                            className="inline-flex items-center justify-center bg-gray-100 border border-gray-300 rounded-md p-2 hover:bg-blue-100 hover:border-blue-400 transition-colors focus:outline-none focus:ring-2 focus:ring-blue-400"
                            title={t('viewBreakdown')}
                          >
                            <MdOutlineReceiptLong className="text-blue-500 text-lg" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="flex justify-between items-center mt-4">
                <div className="flex items-center gap-2">
                  <span>{t('rowsPerPage')}:</span>
                  <select
                    value={pageSize}
                    onChange={(e) => setPageSize(Number(e.target.value))}
                    className="border rounded px-2 py-1"
                  >
                    <option value={5}>5</option>
                    <option value={10}>10</option>
                    <option value={20}>20</option>
                  </select>
                </div>
                <div className="flex items-center gap-2">
                  <span>{t('page')} {page} {t('of')} {totalPages}</span>
                  <Button variant="outline" onClick={() => setPage(1)} disabled={page === 1}>{t('first')}</Button>
                  <Button variant="outline" onClick={() => setPage(page - 1)} disabled={page === 1}>{t('previous')}</Button>
                  <Button variant="outline" onClick={() => setPage(page + 1)} disabled={page === totalPages}>{t('next')}</Button>
                  <Button variant="outline" onClick={() => setPage(totalPages)} disabled={page === totalPages}>{t('last')}</Button>
                </div>
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Breakdown Modal */}
      <Dialog open={showBreakdown} onOpenChange={setShowBreakdown}>
        <DialogContent className="max-h-[80vh] overflow-y-auto w-full sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t('viewBreakdown')}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            {isLoading ? (
              <Skeleton className="h-12 w-full" />
            ) : error ? (
              <div className="text-red-500 text-xs">{t('noData')}</div>
            ) : (
              <div className="space-y-2">
                <p className="text-sm font-medium">{t('currentSalary')}</p>
                <p className="text-2xl">${data?.currentSalary?.amount || '-'}</p>
                <div className="mt-4">
                  {typeof data?.currentSalary?.breakdown === 'string' && data.currentSalary.breakdown.trim() !== '' ? (
                    <ul className="space-y-2">
                      {data.currentSalary.breakdown.split(/\n|\r|\r\n/).map((line: string, idx: number) => {
                        let icon = <FaCalculator className="inline mr-2 text-gray-500" />;
                        if (line.toLowerCase().includes('base salary')) icon = <FaMoneyBillWave className="inline mr-2 text-green-600" />;
                        else if (line.toLowerCase().includes('overtime')) icon = <FaClock className="inline mr-2 text-blue-500" />;
                        else if (line.toLowerCase().includes('bonus')) icon = <FaGift className="inline mr-2 text-yellow-500" />;
                        else if (line.toLowerCase().includes('deduction')) icon = <FaMinusCircle className="inline mr-2 text-red-500" />;
                        else if (line.toLowerCase().includes('total')) icon = <FaCalculator className="inline mr-2 text-purple-600" />;
                        return (
                          <li key={idx} className="flex items-center text-base break-words">
                            {icon}
                            <span>{line}</span>
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <div className="text-muted-foreground text-sm">{t('noData')}</div>
                  )}
                </div>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 