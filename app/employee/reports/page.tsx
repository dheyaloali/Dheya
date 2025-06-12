"use client"

import { useSession } from "next-auth/react";
import useSWR, { mutate } from "swr";
import { useState } from "react";
import { Skeleton } from "@/components/ui/skeleton";
import { Card, CardHeader, CardTitle, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { format } from "date-fns";
import { ClipboardList, ChevronRight, Pencil, Trash2, Plus, Eye } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { toast } from "@/components/ui/use-toast";
import { useTranslations } from "next-intl";

const fetcher = (url: string) => fetch(url).then(res => res.json());

export default function EmployeeReportsPage() {
  const { data: session } = useSession();
  const employeeId = session?.user?.id;
  const [page, setPage] = useState(1);
  const [type, setType] = useState('all');
  const [status, setStatus] = useState('all');
  const [dateRange, setDateRange] = useState<{from: string, to: string} | null>(null);
  const [selectedReport, setSelectedReport] = useState<any | null>(null);
  const [editReport, setEditReport] = useState<any | null>(null);
  const [showCreate, setShowCreate] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<{ open: boolean, id: string | null }>({ open: false, id: null });
  const [pageSize, setPageSize] = useState(10);
  const t = useTranslations('Reports');

  let params = new URLSearchParams({
    page: page.toString(),
    pageSize: pageSize.toString(),
    employeeId: employeeId || '',
  });
  if (type !== 'all') params.append('type', type);
  if (status !== 'all') params.append('status', status);
  if (dateRange) {
    params.append('startDate', dateRange.from);
    params.append('endDate', dateRange.to);
  }
  const url = employeeId ? `/api/employee/reports?${params.toString()}&sort=date_desc` : null;
  const { data, error, isLoading, mutate: mutateReports } = useSWR(url, fetcher);
  const reports = data?.reports || [];
  const totalPages = data?.totalPages || 1;

  // Create Report Handler
  async function handleCreate(newReport: any) {
    try {
      const res = await fetch('/api/employee/reports', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newReport),
      });
      if (!res.ok) throw new Error('Failed to create report');
      toast({ title: 'Report created!' });
      setShowCreate(false);
      mutateReports();
    } catch (e) {
      toast({ title: 'Error', description: 'Could not create report', variant: 'destructive' });
    }
  }

  // Edit Report Handler
  async function handleEdit(updatedReport: any) {
    try {
      const res = await fetch(`/api/employee/reports/${updatedReport.id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(updatedReport),
      });
      if (!res.ok) throw new Error('Failed to update report');
      toast({ title: 'Report updated!' });
      setEditReport(null);
      mutateReports();
    } catch (e) {
      toast({ title: 'Error', description: 'Could not update report', variant: 'destructive' });
    }
  }

  // Delete Report Handler
  async function handleDelete(id: string) {
    try {
      await mutateReports(async (current: any) => {
        // Optimistic update
        const optimistic = { ...current, reports: current.reports.filter((r: any) => r.id !== id) };
        const res = await fetch(`/api/employee/reports/${id}`, { method: 'DELETE' });
        if (!res.ok) throw new Error('Failed to delete report');
        toast({ title: 'Report deleted!' });
        return optimistic;
      }, { rollbackOnError: true, revalidate: true });
    } catch (e) {
      toast({ title: 'Error', description: 'Could not delete report', variant: 'destructive' });
    }
  }

  return (
    <div className="w-full max-w-5xl mx-auto p-4 md:p-8">
      <Card>
        <CardHeader>
          <CardTitle className="text-2xl font-bold flex items-center gap-2">
            <ClipboardList className="h-6 w-6 text-amber-500" /> {t('myReports')}
            <Button variant="outline" size="sm" className="ml-auto" onClick={() => setShowCreate(true)}>
              <Plus className="h-4 w-4 mr-1" /> {t('createReport')}
            </Button>
          </CardTitle>
        </CardHeader>
        <CardContent>
          {/* Filters (future extensible) */}
          <div className="flex flex-wrap gap-4 mb-4">
            <select value={type} onChange={e => { setType(e.target.value); setPage(1); }} className="border rounded px-2 py-1">
              <option value="all">{t('allTypes')}</option>
              <option value="time">{t('time')}</option>
              <option value="absence">{t('absence')}</option>
              <option value="sales">{t('sales')}</option>
            </select>
            <select value={status} onChange={e => { setStatus(e.target.value); setPage(1); }} className="border rounded px-2 py-1">
              <option value="all">{t('allStatus')}</option>
              <option value="pending">{t('pending')}</option>
              <option value="approved">{t('approved')}</option>
              <option value="rejected">{t('rejected')}</option>
            </select>
            {/* Date range filter */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium">{t('from')}</label>
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={dateRange?.from || ''}
                onChange={e => {
                  setDateRange(r => ({ from: e.target.value, to: r?.to || '' }));
                  setPage(1);
                }}
                max={dateRange?.to || ''}
              />
              <label className="text-xs font-medium">{t('to')}</label>
              <input
                type="date"
                className="border rounded px-2 py-1"
                value={dateRange?.to || ''}
                onChange={e => {
                  setDateRange(r => ({ from: r?.from || '', to: e.target.value }));
                  setPage(1);
                }}
                min={dateRange?.from || ''}
              />
            </div>
            {/* Page size selector */}
            <div className="flex items-center gap-2">
              <label className="text-xs font-medium">{t('show')}</label>
              <select
                value={pageSize}
                onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                className="border rounded px-2 py-1"
              >
                {[5, 10, 20, 50, 100].map(size => (
                  <option key={size} value={size}>{size}</option>
                ))}
              </select>
              <span className="text-xs">{t('perPage')}</span>
            </div>
          </div>
          {/* Table/List */}
          {isLoading ? (
            <div className="space-y-3 border rounded-lg bg-white shadow-sm p-2">
              {[...Array(pageSize)].map((_, i) => (
                <Skeleton key={i} className="h-14 w-full" />
              ))}
            </div>
          ) : error ? (
            <div className="text-red-500 border rounded-lg bg-white shadow-sm p-4">{t('failedToLoadReports')}</div>
          ) : reports.length === 0 ? (
            <div className="text-muted-foreground text-center py-8 border rounded-lg bg-white shadow-sm">{t('noReportsFound')}</div>
          ) : (
            <div className="divide-y max-h-[420px] overflow-y-auto pr-2 border rounded-lg bg-white shadow-sm p-4 my-3">
              {reports.map((report: any) => (
                <div key={report.id} className="flex items-center gap-4 py-3 px-4 hover:bg-muted/50 transition rounded-md">
                  <div className="w-32 text-xs text-muted-foreground">{format(new Date(report.date), 'MMM dd, yyyy')}</div>
                  <div className="w-24 text-xs font-medium">{t(report.type)}</div>
                  <div className="w-24 text-xs">
                    <span className={
                      report.status === 'approved' ? 'text-green-600' :
                      report.status === 'rejected' ? 'text-red-600' :
                      'text-yellow-600'
                    }>
                      {t(report.status)}
                    </span>
                  </div>
                  <div className="flex-1 text-xs truncate">{report.notes || report.details?.summary || t('noDetails')}</div>
                  <Button variant="ghost" size="icon" className="ml-2" onClick={() => setSelectedReport(report)} title={t('view')}>
                    <Eye className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="ml-2" onClick={() => setEditReport(report)}>
                    <Pencil className="h-4 w-4" />
                  </Button>
                  <Button variant="ghost" size="icon" className="ml-2" onClick={() => setShowDeleteConfirm({ open: true, id: report.id })}>
                    <Trash2 className="h-4 w-4 text-red-500" />
                  </Button>
                </div>
              ))}
            </div>
          )}
          {/* Pagination */}
          <div className="flex justify-end gap-2 mt-6">
            <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.max(1, p - 1))} disabled={page === 1}>Prev</Button>
            <span className="text-xs px-2 py-1">Page {page} of {totalPages}</span>
            <Button variant="outline" size="sm" onClick={() => setPage(p => Math.min(totalPages, p + 1))} disabled={page === totalPages}>Next</Button>
            <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages}>Last</Button>
          </div>
        </CardContent>
      </Card>
      {/* Report Detail Modal */}
      <Dialog open={!!selectedReport} onOpenChange={open => !open && setSelectedReport(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Report Details</DialogTitle>
            <DialogDescription asChild>
              {selectedReport && (
                <div className="space-y-2 mt-2">
                  <div><span className="font-semibold">Date:</span> {format(new Date(selectedReport.date), 'PPP')}</div>
                  <div><span className="font-semibold">Type:</span> {selectedReport.type}</div>
                  <div><span className="font-semibold">Status:</span> <span className={
                    selectedReport.status === 'approved' ? 'text-green-600' :
                    selectedReport.status === 'rejected' ? 'text-red-600' :
                    'text-yellow-600'
                  }>{selectedReport.status}</span></div>
                  <div><span className="font-semibold">Notes:</span> {selectedReport.notes || 'No notes'}</div>
                  {selectedReport.details && (
                    <div><span className="font-semibold">Details:</span> <pre className="bg-muted rounded p-2 text-xs overflow-x-auto">{JSON.stringify(selectedReport.details, null, 2)}</pre></div>
                  )}
                </div>
              )}
            </DialogDescription>
          </DialogHeader>
        </DialogContent>
      </Dialog>
      {/* Create/Edit Report Modal (simple form for demo) */}
      <Dialog open={showCreate || !!editReport} onOpenChange={open => { if (!open) { setShowCreate(false); setEditReport(null); } }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editReport ? 'Edit Report' : 'Create Report'}</DialogTitle>
          </DialogHeader>
          <form className="space-y-4" onSubmit={async e => {
            e.preventDefault();
            const form = e.target as HTMLFormElement;
            const formData = Object.fromEntries(new FormData(form));
            if (editReport) {
              await handleEdit({ ...editReport, ...formData });
            } else {
              await handleCreate({ ...formData, employeeId });
            }
          }}>
            <div>
              <label className="block text-xs font-medium mb-1">Type</label>
              <select name="type" defaultValue={editReport?.type || ''} required className="border rounded px-2 py-1 w-full">
                <option value="">Select type</option>
                <option value="time">Time</option>
                <option value="absence">Absence</option>
                <option value="sales">Sales</option>
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Notes</label>
              <textarea name="notes" defaultValue={editReport?.notes || ''} className="border rounded px-2 py-1 w-full" rows={3} />
            </div>
            <div className="flex justify-end gap-2">
              <Button variant="outline" type="button" onClick={() => { setShowCreate(false); setEditReport(null); }}>Cancel</Button>
              <Button type="submit">{editReport ? 'Save' : 'Create'}</Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={showDeleteConfirm.open} onOpenChange={open => { if (!open) setShowDeleteConfirm({ open: false, id: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Report</DialogTitle>
            <DialogDescription>Are you sure you want to delete this report? This action cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="flex justify-end gap-2 mt-4">
            <Button variant="outline" onClick={() => setShowDeleteConfirm({ open: false, id: null })}>Cancel</Button>
            <Button variant="destructive" onClick={async () => {
              if (showDeleteConfirm.id) await handleDelete(showDeleteConfirm.id);
              setShowDeleteConfirm({ open: false, id: null });
            }}>Delete</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
} 