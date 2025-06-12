import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import React from "react";
import type { AttendanceStatus } from "@/lib/mock-data";

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  employeeName: string;
  date: string;
  checkIn: string | null;
  checkOut: string | null;
  status: AttendanceStatus;
  workHours: string;
  notes?: string;
}

interface AttendanceRecordsTableProps {
  records: AttendanceRecord[];
  total: number;
  page: number;
  pageSize: number;
  setPage: (page: number) => void;
  setPageSize: (size: number) => void;
}

export const AttendanceRecordsTable = ({ records, total, page, pageSize, setPage, setPageSize }: AttendanceRecordsTableProps) => {
  const totalPages = Math.ceil(total / pageSize);
  return (
    <div className="w-full">
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm">
          <thead>
            <tr>
              <th className="px-2 py-2 text-left">Employee</th>
              <th className="px-2 py-2 text-left">Date</th>
              <th className="px-2 py-2 text-left">Check In</th>
              <th className="px-2 py-2 text-left">Check Out</th>
              <th className="px-2 py-2 text-left">Status</th>
              <th className="px-2 py-2 text-left">Work Hours</th>
              <th className="px-2 py-2 text-left">Notes</th>
            </tr>
          </thead>
          <tbody>
            {records.map((record) => (
              <tr key={record.id} className="border-b">
                <td className="px-2 py-2 flex items-center gap-2">
                  <Avatar className="h-8 w-8">
                    <AvatarFallback>{record.employeeName.split(" ").map((n) => n[0]).join("")}</AvatarFallback>
                  </Avatar>
                  <span>{record.employeeName}</span>
                </td>
                <td className="px-2 py-2">{new Date(record.date).toLocaleDateString()}</td>
                <td className="px-2 py-2">{record.checkIn ? new Date(record.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="px-2 py-2">{record.checkOut ? new Date(record.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                <td className="px-2 py-2">
                  <Badge variant="outline">{record.status}</Badge>
                </td>
                <td className="px-2 py-2">{record.workHours}</td>
                <td className="px-2 py-2 max-w-[200px] truncate">{record.notes || '-'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Pagination Controls */}
      <div className="flex items-center justify-between mt-4">
        <div className="flex items-center gap-2">
          <span>Rows per page:</span>
          <select
            className="border rounded px-2 py-1 text-sm"
            value={pageSize}
            onChange={e => setPage(Number(e.target.value))}
          >
            {[5, 10, 20, 25, 50, 100].map(size => (
              <option key={size} value={size}>{size}</option>
            ))}
          </select>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setPage(1)} disabled={page === 1}>First</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(Math.max(1, page - 1))} disabled={page === 1}>&lt; Prev</Button>
          {Array.from({ length: totalPages }, (_, i) => (
            <Button
              key={i + 1}
              variant={page === i + 1 ? "default" : "outline"}
              size="sm"
              onClick={() => setPage(i + 1)}
            >
              {i + 1}
            </Button>
          ))}
          <Button variant="outline" size="sm" onClick={() => setPage(Math.min(totalPages, page + 1))} disabled={page === totalPages || totalPages === 0}>Next &gt;</Button>
          <Button variant="outline" size="sm" onClick={() => setPage(totalPages)} disabled={page === totalPages || totalPages === 0}>Last</Button>
        </div>
      </div>
    </div>
  );
};

export const AttendanceRecordsTableSkeleton = () => (
  <div className="space-y-4">
    <div className="grid grid-cols-[25px_1fr_120px_120px_120px] items-center gap-4">
      <span className="font-medium">#</span>
      <span className="font-medium">Employee</span>
      <span className="font-medium">City</span>
      <span className="font-medium">Check In</span>
      <span className="font-medium">Status</span>
    </div>
    {[...Array(4)].map((_, i) => (
      <div key={i} className="grid grid-cols-[25px_1fr_120px_120px_120px] items-center gap-4">
        <Skeleton className="h-4 w-4" />
        <div className="flex items-center gap-2">
          <Skeleton className="h-8 w-8 rounded-full" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-4 w-16" />
        <Skeleton className="h-6 w-16 rounded-full" />
      </div>
    ))}
  </div>
); 