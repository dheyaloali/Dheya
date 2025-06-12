import { useToast } from "@/components/ui/use-toast";
import { useSWR } from "swr";
import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { LoadingButton } from "@/components/ui/loading-button";

export default function ReportsTab() {
  const { toast } = useToast();
  const { data: reportsData, error: reportsError, isLoading: reportsLoading, mutate: mutateReports } = useSWR("/api/reports", fetcher);
  const [isDeletingReport, setIsDeletingReport] = useState(false);
  const [isApprovingReport, setIsApprovingReport] = useState(false);
  const [isRejectingReport, setIsRejectingReport] = useState(false);
  const [actionError, setActionError] = useState<string | null>(null);
  const [deleteConfirmReport, setDeleteConfirmReport] = useState<Report | null>(null);
  const [rejectConfirmReport, setRejectConfirmReport] = useState<Report | null>(null);
  const [rejectReason, setRejectReason] = useState("");

  const handleDeleteReport = async (reportId: string | number) => {
    setIsDeletingReport(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/reports/${reportId}`, {
        method: "DELETE",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to delete report");
      }
      await mutateReports();
      toast({
        title: "Report Deleted",
        description: "Report has been deleted successfully!",
      });
      setDeleteConfirmReport(null);
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to delete report");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to delete report",
        variant: "destructive",
      });
    } finally {
      setIsDeletingReport(false);
    }
  };

  const handleApproveReport = async (reportId: string | number) => {
    setIsApprovingReport(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/approve`, {
        method: "POST",
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to approve report");
      }
      await mutateReports();
      toast({
        title: "Report Approved",
        description: "Report has been approved successfully!",
      });
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to approve report");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to approve report",
        variant: "destructive",
      });
    } finally {
      setIsApprovingReport(false);
    }
  };

  const handleRejectReport = async (reportId: string | number, reason: string) => {
    setIsRejectingReport(true);
    setActionError(null);
    try {
      const response = await fetch(`/api/reports/${reportId}/reject`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || "Failed to reject report");
      }
      await mutateReports();
      toast({
        title: "Report Rejected",
        description: "Report has been rejected successfully!",
      });
      setRejectConfirmReport(null);
      setRejectReason("");
    } catch (err) {
      setActionError(err instanceof Error ? err.message : "Failed to reject report");
      toast({
        title: "Error",
        description: err instanceof Error ? err.message : "Failed to reject report",
        variant: "destructive",
      });
    } finally {
      setIsRejectingReport(false);
    }
  };

  return (
    <div className="space-y-4">
      {/* ... existing table code ... */}

      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmReport} onOpenChange={open => { if (!open) setDeleteConfirmReport(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to delete this report?</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmReport(null)}>Cancel</Button>
            <LoadingButton
              variant="destructive"
              loading={isDeletingReport}
              loadingText="Deleting..."
              onClick={() => {
                if (deleteConfirmReport) {
                  handleDeleteReport(deleteConfirmReport.id);
                }
              }}
            >
              Delete
            </LoadingButton>
          </DialogFooter>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>

      {/* Reject Confirmation Dialog */}
      <Dialog open={!!rejectConfirmReport} onOpenChange={open => { if (!open) setRejectConfirmReport(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Report</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>Please provide a reason for rejecting this report:</div>
            <Textarea
              value={rejectReason}
              onChange={(e) => setRejectReason(e.target.value)}
              placeholder="Enter rejection reason..."
              className="min-h-[100px]"
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRejectConfirmReport(null)}>Cancel</Button>
            <LoadingButton
              variant="destructive"
              loading={isRejectingReport}
              loadingText="Rejecting..."
              onClick={() => {
                if (rejectConfirmReport) {
                  handleRejectReport(rejectConfirmReport.id, rejectReason);
                }
              }}
              disabled={!rejectReason.trim()}
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