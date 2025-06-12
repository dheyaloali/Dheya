import React, { useState } from "react";
import useSWR from "swr";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Checkbox } from "@/components/ui/checkbox";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useToast } from "@/components/ui/use-toast";
import { LoadingButton } from "@/components/ui/loading-button";

const PAGE_SIZE_OPTIONS = [5, 10, 20, 25, 50, 100];

function formatDate(dateString: string) {
  const date = new Date(dateString);
  return date.toLocaleDateString("en-US", { year: "numeric", month: "short", day: "numeric" });
}

export default function DocumentDeleteRequestsTable() {
  const { toast } = useToast();
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  const [selected, setSelected] = useState<number[]>([]);
  const [rejectingIds, setRejectingIds] = useState<number[]>([]);
  const [rejectionReason, setRejectionReason] = useState("");
  const [showRejectDialog, setShowRejectDialog] = useState(false);
  const [bulkAction, setBulkAction] = useState<"approve" | "reject" | "delete" | null>(null);
  const [isBulkApproving, setIsBulkApproving] = useState(false);
  const [isBulkRejecting, setIsBulkRejecting] = useState(false);
  const [isBulkDeleting, setIsBulkDeleting] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);

  // Fetch delete requests with pagination
  const { data, error, isLoading, mutate } = useSWR(
    `/api/admin/documents/delete-requests?page=${page}&limit=${pageSize}`,
    url => fetch(url).then(res => res.json())
  );
  const requests = data?.requests || [];
  const total = data?.total || requests.length;
  const totalPages = data?.totalPages || 1;

  // Selection logic
  const allSelected = requests.length > 0 && selected.length === requests.length;
  const toggleSelectAll = () => setSelected(allSelected ? [] : requests.map((r: any) => r.id));
  const toggleSelect = (id: number) => setSelected(selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id]);

  // Bulk actions
  const handleBulkApprove = async () => {
    setIsBulkApproving(true);
    setActionError(null);
    try {
      for (const id of selected) {
        await handleAction(id, "approve");
      }
      setSelected([]);
      await mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to approve requests");
    } finally {
      setIsBulkApproving(false);
    }
  };

  const handleBulkDelete = async () => {
    setIsBulkDeleting(true);
    setActionError(null);
    try {
      for (const id of selected) {
        await handleDelete(id);
      }
      setSelected([]);
      await mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete requests");
    } finally {
      setIsBulkDeleting(false);
    }
  };

  const handleBulkReject = () => {
    setRejectingIds(selected);
    setShowRejectDialog(true);
  };

  // Track individual action states
  const [processingAction, setProcessingAction] = useState<{id: number, action: string} | null>(null);

  // Single actions
  const handleAction = async (id: number, action: "approve" | "reject", reason?: string) => {
    // Prevent multiple operations on the same request
    if (processingAction && processingAction.id === id) {
      console.log(`Already processing ${processingAction.action} for request ${id}, ignoring duplicate request`);
      return;
    }
    
    setProcessingAction({id, action});
    setActionError(null);
    
    try {
      // Show immediate feedback toast
      toast({
        title: `${action === "approve" ? "Approving" : "Rejecting"} request`,
        description: "Please wait...",
      });
      
      const res = await fetch(`/api/admin/documents/delete-requests/${id}`, {
        method: "PATCH",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        body: JSON.stringify({ action, reason }),
      });
      
      if (!res.ok) throw new Error("Failed to update request");
      toast({ title: `Request ${action === "approve" ? "approved" : "rejected"}` });
      await mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update request");
      throw error;
    } finally {
      setProcessingAction(null);
    }
  };

  const handleDelete = async (id: number) => {
    // Prevent multiple operations on the same request
    if (processingAction && processingAction.id === id) {
      console.log(`Already processing ${processingAction.action} for request ${id}, ignoring duplicate request`);
      return;
    }
    
    setProcessingAction({id, action: "delete"});
    setActionError(null);
    
    try {
      // Show immediate feedback toast
      toast({
        title: "Deleting request",
        description: "Please wait...",
      });
      
      const res = await fetch(`/api/admin/documents/delete-requests/${id}`, { 
        method: "DELETE",
        headers: { 
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      
      if (!res.ok) throw new Error("Failed to delete request");
      toast({ title: "Request deleted" });
      await mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete request");
      throw error;
    } finally {
      setProcessingAction(null);
    }
  };

  // Pagination controls
  const goToFirst = () => setPage(1);
  const goToPrev = () => setPage(p => Math.max(1, p - 1));
  const goToNext = () => setPage(p => Math.min(totalPages, p + 1));
  const goToLast = () => setPage(totalPages);

  // Reject dialog confirm
  const confirmBulkReject = async () => {
    setIsBulkRejecting(true);
    setActionError(null);
    try {
      for (const id of rejectingIds) {
        await handleAction(id, "reject", rejectionReason);
      }
      setRejectingIds([]);
      setShowRejectDialog(false);
      setRejectionReason("");
      setSelected([]);
      await mutate();
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to reject requests");
    } finally {
      setIsBulkRejecting(false);
    }
  };

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-lg border shadow-sm p-4">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-xl font-bold">Document Delete Requests</h2>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkApprove}
              disabled={selected.length === 0 || isBulkApproving}
            >
              {isBulkApproving ? "Approving..." : "Approve Selected"}
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={handleBulkReject}
              disabled={selected.length === 0 || isBulkRejecting}
            >
              {isBulkRejecting ? "Rejecting..." : "Reject Selected"}
            </Button>
            <Button
              variant="destructive"
              size="sm"
              onClick={handleBulkDelete}
              disabled={selected.length === 0 || isBulkDeleting}
            >
              {isBulkDeleting ? "Deleting..." : "Delete Selected"}
            </Button>
          </div>
        </div>
        <div className="overflow-x-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead><Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} /></TableHead>
                <TableHead>Document</TableHead>
                <TableHead>Employee</TableHead>
                <TableHead>Reason</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Created</TableHead>
                <TableHead>Reviewed</TableHead>
                <TableHead>Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                <TableRow><TableCell colSpan={8}>Loading...</TableCell></TableRow>
              ) : error ? (
                <TableRow><TableCell colSpan={8} className="text-red-500">Error loading requests: {error.message || String(error)}</TableCell></TableRow>
              ) : requests.length === 0 ? (
                <TableRow><TableCell colSpan={8}>No delete requests found</TableCell></TableRow>
              ) : requests.map((req: any) => (
                <TableRow key={req.id}>
                  <TableCell><Checkbox checked={selected.includes(req.id)} onCheckedChange={() => toggleSelect(req.id)} /></TableCell>
                  <TableCell>{req.document?.title || "-"}</TableCell>
                  <TableCell>{req.employee?.user?.name || "-"}</TableCell>
                  <TableCell className="max-w-xs truncate" title={req.reason}>{req.reason}</TableCell>
                  <TableCell>{req.status}</TableCell>
                  <TableCell>{formatDate(req.createdAt)}</TableCell>
                  <TableCell>{req.reviewedAt ? formatDate(req.reviewedAt) : "-"}</TableCell>
                  <TableCell>
                    <div className="flex gap-1">
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => handleAction(req.id, "approve")}
                        disabled={processingAction?.id === req.id}
                        className={processingAction?.id === req.id ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {processingAction?.id === req.id && processingAction?.action === "approve" ? "Approving..." : "Approve"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="outline" 
                        onClick={() => { setRejectingIds([req.id]); setShowRejectDialog(true); }}
                        disabled={processingAction?.id === req.id}
                        className={processingAction?.id === req.id ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {processingAction?.id === req.id && processingAction?.action === "reject" ? "Rejecting..." : "Reject"}
                      </Button>
                      <Button 
                        size="sm" 
                        variant="destructive" 
                        onClick={() => handleDelete(req.id)}
                        disabled={processingAction?.id === req.id}
                        className={processingAction?.id === req.id ? "opacity-50 cursor-not-allowed" : ""}
                      >
                        {processingAction?.id === req.id && processingAction?.action === "delete" ? "Deleting..." : "Delete"}
                      </Button>
                    </div>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
        {/* Pagination Controls */}
        <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-2">
          <div className="flex items-center gap-2">
            <span>Rows per page:</span>
            <select className="border rounded px-2 py-1 text-sm" value={pageSize} onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}>
              {PAGE_SIZE_OPTIONS.map(size => (<option key={size} value={size}>{size}</option>))}
            </select>
          </div>
          <div className="text-xs text-gray-500">Page {page} of {totalPages}</div>
          <div className="flex gap-2">
            <Button size="sm" variant="outline" onClick={goToFirst} disabled={page === 1}>First</Button>
            <Button size="sm" variant="outline" onClick={goToPrev} disabled={page === 1}>Prev</Button>
            <Button size="sm" variant="outline" onClick={goToNext} disabled={page === totalPages || totalPages === 0}>Next</Button>
            <Button size="sm" variant="outline" onClick={goToLast} disabled={page === totalPages || totalPages === 0}>Last</Button>
          </div>
        </div>
      </div>
      {/* Reject Dialog */}
      <Dialog open={showRejectDialog} onOpenChange={setShowRejectDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject {rejectingIds.length > 1 ? "Requests" : "Request"}</DialogTitle>
          </DialogHeader>
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Reason for rejection</label>
            <Input
              value={rejectionReason}
              onChange={e => setRejectionReason(e.target.value)}
              placeholder="Enter reason..."
              required
              autoFocus
            />
          </div>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowRejectDialog(false);
                setRejectingIds([]);
                setRejectionReason("");
              }}
            >
              Cancel
            </Button>
            <LoadingButton
              variant="destructive"
              disabled={!rejectionReason.trim() || isBulkRejecting}
              loading={isBulkRejecting}
              loadingText="Rejecting..."
              onClick={confirmBulkReject}
            >
              Reject
            </LoadingButton>
          </DialogFooter>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>
    </div>
  );
} 