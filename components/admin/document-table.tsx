"use client"

import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import {
  Download,
  Trash2,
  MoreHorizontal,
  CheckCircle,
  XCircle,
  FileText,
  FileCodeIcon as FileContract,
  FileCheck,
  FileBarChart,
  Info,
} from "lucide-react"
import type { DocumentStatus } from "@/lib/types"
import { Skeleton } from "@/components/ui/skeleton"
import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import Image from "next/image"
import { LoadingButton } from "@/components/ui/loading-button"
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip"
import { Checkbox } from "@/components/ui/checkbox"

export interface Document {
  id: number;
  employeeId: number;
  employeeName: string;
  type: string;
  title: string;
  description?: string;
  fileUrl: string;
  date: string;
  status: string;
  uploadedDuring?: string;
  isRegistrationDocument: boolean;
  rejectionReason?: string;
}

interface DocumentTableProps {
  documents: Document[];
  onDownload: (id: string) => void;
  onDelete: (id: string) => void;
  onStatusChange: (id: string, status: DocumentStatus, reason?: string) => void;
  onNameClick?: (doc: Document) => void;
}

export default function DocumentTable({ documents, onDownload, onDelete, onStatusChange, onNameClick }: DocumentTableProps) {
  const [rejectingDoc, setRejectingDoc] = useState<Document | null>(null)
  const [rejectionReason, setRejectionReason] = useState("")
  const [showReasonDialog, setShowReasonDialog] = useState<{ open: boolean, reason: string | null }>({ open: false, reason: null })
  const [viewingDoc, setViewingDoc] = useState<Document | null>(null)
  const [viewError, setViewError] = useState("")
  const [deleteConfirmDoc, setDeleteConfirmDoc] = useState<Document | null>(null)
  const [isDeleting, setIsDeleting] = useState(false)
  const [isRejecting, setIsRejecting] = useState(false)
  const [isApproving, setIsApproving] = useState(false)
  const [actionError, setActionError] = useState<string | null>(null)
  
  // Track which document is being processed for individual actions
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null)
  const [deletingDocId, setDeletingDocId] = useState<string | null>(null)

  const [selected, setSelected] = useState<number[]>([])
  const [isBulkApproving, setIsBulkApproving] = useState(false)
  const [isBulkRejecting, setIsBulkRejecting] = useState(false)
  const [batchResults, setBatchResults] = useState<{ id: number, status: string, error?: string }[]>([])
  const [showApproveDialog, setShowApproveDialog] = useState(false)
  const [showBulkRejectDialog, setShowBulkRejectDialog] = useState(false)
  const [bulkRejectionReason, setBulkRejectionReason] = useState("")

  const allSelected = documents.length > 0 && selected.length === documents.length
  const toggleSelectAll = () => setSelected(allSelected ? [] : documents.map((doc) => doc.id))
  const toggleSelect = (id: number) => setSelected(selected.includes(id) ? selected.filter(i => i !== id) : [...selected, id])

  // Function to get the appropriate icon based on document type
  const getDocumentIcon = (type: string) => {
    switch (type) {
      case "ID Document":
        return <FileText className="h-5 w-5 text-blue-500" />
      case "Contract":
        return <FileContract className="h-5 w-5 text-purple-500" />
      case "Certificate":
        return <FileCheck className="h-5 w-5 text-green-500" />
      case "Report":
        return <FileBarChart className="h-5 w-5 text-orange-500" />
      default:
        return <FileText className="h-5 w-5 text-gray-500" />
    }
  }

  // Function to get the appropriate badge color based on status
  const getStatusBadge = (status: string) => {
    switch (status) {
      case "Approved":
        return (
          <Badge variant="outline" className="bg-green-50 text-green-700 border-green-200">
            Approved
          </Badge>
        )
      case "Pending":
        return (
          <Badge variant="outline" className="bg-yellow-50 text-yellow-700 border-yellow-200">
            Pending
          </Badge>
        )
      case "Rejected":
        return (
          <Badge variant="outline" className="bg-red-50 text-red-700 border-red-200">
            Rejected
          </Badge>
        )
      default:
        return (
          <Badge variant="outline" className="bg-gray-50 text-gray-700 border-gray-200">
            {status}
          </Badge>
        )
    }
  }

  // Format date to be more readable
  const formatDate = (dateString: string) => {
    const date = new Date(dateString)
    return date.toLocaleDateString("en-US", {
      year: "numeric",
      month: "short",
      day: "numeric",
    })
  }

  // Add a function to determine file type
  const getFileType = (url: string) => {
    if (url.endsWith(".pdf")) return "pdf";
    if (url.match(/\.(jpg|jpeg|png|webp)$/i)) return "image";
    return "other";
  }

  const handleStatusChange = async (id: string, status: DocumentStatus, reason?: string) => {
    // Prevent multiple operations on the same document
    if (changingStatusId === id) {
      console.log(`Already processing status change for document ${id}, ignoring duplicate request`);
      return;
    }
    
    if (status === "Approved") {
      setIsApproving(true);
    } else if (status === "Rejected") {
      setIsRejecting(true);
    }
    setChangingStatusId(id);
    setActionError(null);
    
    try {
      await onStatusChange(id, status, reason);
      if (status === "Rejected") {
        setRejectingDoc(null);
        setRejectionReason("");
      }
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to update status");
    } finally {
      if (status === "Approved") {
        setIsApproving(false);
      } else if (status === "Rejected") {
        setIsRejecting(false);
      }
      setChangingStatusId(null);
    }
  };

  const handleDelete = async (id: string) => {
    // Prevent multiple delete operations on the same document
    if (deletingDocId === id) {
      console.log(`Already deleting document ${id}, ignoring duplicate request`);
      return;
    }
    
    setIsDeleting(true);
    setDeletingDocId(id);
    setActionError(null);
    
    try {
      await onDelete(id);
      setDeleteConfirmDoc(null);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Failed to delete document");
    } finally {
      setIsDeleting(false);
      setDeletingDocId(null);
    }
  };

  const handleBulkApprove = async () => {
    setIsBulkApproving(true);
    setBatchResults([]);
    try {
      const res = await fetch("/api/admin/documents/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, action: "approve" }),
      });
      const data = await res.json();
      setBatchResults(data.results || []);
      setSelected([]);
    } catch (error) {
      // Optionally show a toast
    } finally {
      setIsBulkApproving(false);
    }
  };

  const handleBulkReject = async (reason: string) => {
    setIsBulkRejecting(true);
    setBatchResults([]);
    try {
      const res = await fetch("/api/admin/documents/batch", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected, action: "reject", reason }),
      });
      const data = await res.json();
      setBatchResults(data.results || []);
      setSelected([]);
    } catch (error) {
      // Optionally show a toast
    } finally {
      setIsBulkRejecting(false);
    }
  };

  return (
    <TooltipProvider>
      <div className="relative">
        <div className="mb-4 flex gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowApproveDialog(true)}
            disabled={selected.length === 0 || isBulkApproving || isBulkRejecting}
          >
            {isBulkApproving ? "Approving..." : "Approve Selected"}
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={() => setShowBulkRejectDialog(true)}
            disabled={selected.length === 0 || isBulkApproving || isBulkRejecting}
          >
            {isBulkRejecting ? "Rejecting..." : "Reject Selected"}
          </Button>
        </div>
        {/* Approve Confirmation Dialog */}
        <Dialog open={showApproveDialog} onOpenChange={setShowApproveDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Approve Selected Documents</DialogTitle>
            </DialogHeader>
            <div className="mb-4">
              Are you sure you want to approve the selected documents?
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowApproveDialog(false)}>
                Cancel
              </Button>
              <LoadingButton
                variant="default"
                disabled={isBulkApproving}
                loading={isBulkApproving}
                loadingText="Approving..."
                onClick={async () => {
                  await handleBulkApprove();
                  setShowApproveDialog(false);
                }}
              >
                Approve
              </LoadingButton>
            </DialogFooter>
          </DialogContent>
        </Dialog>
    <div className="relative">
      <div className="border-b">
        <table className="w-full">
          <thead>
            <tr>
                  <th className="p-4"><Checkbox checked={allSelected} onCheckedChange={toggleSelectAll} /></th>
              <th className="text-left p-4">Document</th>
              <th className="text-left p-4">Employee</th>
              <th className="text-left p-4">Date</th>
              <th className="text-left p-4">Status</th>
              <th className="text-right p-4">Actions</th>
            </tr>
          </thead>
        </table>
      </div>
      
      {/* Scrollable table body */}
      <div className="overflow-y-auto max-h-[500px]">
        <table className="w-full">
          <tbody>
            {documents.length === 0 ? (
              <tr>
                <td colSpan={5} className="text-center py-10 text-gray-500">
                  No documents found
                </td>
              </tr>
            ) : (
                  documents.map((doc) => {
                    const batchResult = batchResults.find(r => r.id === doc.id);
                    const isError = batchResult?.status === "error";
                    const isSuccess = batchResult && batchResult.status !== "error";
                    return (
                      <tr
                        key={doc.id}
                        className={isError ? "bg-red-50" : isSuccess ? "bg-green-50" : ""}
                      >
                  <td className="p-4">
                    <div className="flex items-center space-x-3">
                            <Checkbox checked={selected.includes(doc.id)} onCheckedChange={() => toggleSelect(doc.id)} />
                            {batchResult ? (
                              isError ? (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <XCircle className="h-5 w-5 text-red-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>{batchResult.error || "Error"}</p>
                                  </TooltipContent>
                                </Tooltip>
                              ) : (
                                <Tooltip>
                                  <TooltipTrigger>
                                    <CheckCircle className="h-5 w-5 text-green-500" />
                                  </TooltipTrigger>
                                  <TooltipContent>
                                    <p>Success</p>
                                  </TooltipContent>
                                </Tooltip>
                              )
                            ) : null}
                      {getDocumentIcon(doc.type)}
                      <div className="flex-1 min-w-0">
                        <button
                          className="text-sm font-medium text-blue-700 underline hover:text-blue-900 truncate text-left w-full"
                          onClick={() => {
                            setViewingDoc(doc)
                            onNameClick && onNameClick(doc)
                          }}
                          type="button"
                        >
                          {doc.title}
                        </button>
                        <p className="text-xs text-gray-500">{doc.type}</p>
                        {doc.isRegistrationDocument && (
                          <Badge variant="outline" className="mt-1 text-xs bg-blue-50 text-blue-700 border-blue-200">
                            Registration
                          </Badge>
                        )}
                        {doc.status === "Rejected" && doc.rejectionReason && (
                          <Button variant="ghost" size="icon" title="View Rejection Reason" onClick={() => setShowReasonDialog({ open: true, reason: doc.rejectionReason ?? null })}>
                            <Info className="h-4 w-4 text-red-500" />
                          </Button>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="p-4 text-sm">{doc.employeeName}</td>
                  <td className="p-4 text-sm">{formatDate(doc.date)}</td>
                  <td className="p-4">{getStatusBadge(doc.status)}</td>
                  <td className="p-4 text-right">
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="icon">
                          <MoreHorizontal className="h-5 w-5" />
                          <span className="sr-only">Open menu</span>
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem 
                          onClick={() => onDownload(doc.id.toString())}
                          disabled={isApproving || isRejecting || isDeleting}
                        >
                          <Download className="mr-2 h-4 w-4" />
                          Download
                        </DropdownMenuItem>
                        {doc.status !== "Approved" && (
                          <DropdownMenuItem 
                            onClick={() => handleStatusChange(doc.id.toString(), "Approved")}
                            disabled={isApproving || isRejecting || isDeleting}
                          >
                            {isApproving && doc.id.toString() === changingStatusId ? (
                              <>
                                <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                                Approving...
                              </>
                            ) : (
                              <>
                                <CheckCircle className="mr-2 h-4 w-4" />
                                Approve
                              </>
                            )}
                          </DropdownMenuItem>
                        )}
                        {doc.status !== "Rejected" && (
                          <DropdownMenuItem 
                            onClick={() => { setRejectingDoc(doc); setRejectionReason(""); }}
                            disabled={isApproving || isRejecting || isDeleting}
                          >
                            <XCircle className="mr-2 h-4 w-4" />
                            Reject
                          </DropdownMenuItem>
                        )}
                        <DropdownMenuItem
                          className="text-red-600"
                          onClick={() => setDeleteConfirmDoc(doc)}
                          disabled={isApproving || isRejecting || isDeleting}
                        >
                          {isDeleting && doc.id.toString() === deletingDocId ? (
                            <>
                              <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                              Deleting...
                            </>
                          ) : (
                            <>
                              <Trash2 className="mr-2 h-4 w-4" />
                              Delete
                            </>
                          )}
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                  </td>
                </tr>
                    );
                  })
            )}
          </tbody>
        </table>
          </div>
      </div>
      {/* Rejection Reason Modal */}
      <Dialog open={!!rejectingDoc} onOpenChange={open => { if (!open) setRejectingDoc(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reject Document</DialogTitle>
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
            <Button variant="outline" onClick={() => setRejectingDoc(null)}>Cancel</Button>
            <LoadingButton
              variant="destructive"
              disabled={!rejectionReason.trim() || isRejecting}
              loading={isRejecting}
              loadingText="Rejecting..."
              onClick={() => {
                if (rejectingDoc) {
                  handleStatusChange(rejectingDoc.id.toString(), "Rejected", rejectionReason);
                }
              }}
            >
              Reject
            </LoadingButton>
          </DialogFooter>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>
      {/* Show Rejection Reason Dialog */}
      <Dialog open={showReasonDialog.open} onOpenChange={open => { if (!open) setShowReasonDialog({ open: false, reason: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Rejection Reason</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            {showReasonDialog.reason}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReasonDialog({ open: false, reason: null })}>Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Document Viewer Dialog */}
      <Dialog open={!!viewingDoc} onOpenChange={() => { setViewingDoc(null); setViewError("") }}>
        <DialogContent className="max-w-2xl">
          <DialogHeader>
            <DialogTitle>View Document</DialogTitle>
          </DialogHeader>
          {viewingDoc && (
            <div>
              {getFileType(viewingDoc.fileUrl) === "pdf" ? (
                <iframe
                  src={viewingDoc.fileUrl}
                  title="PDF Document"
                  className="w-full h-96 border rounded"
                  onError={() => setViewError("Failed to load PDF document.")}
                />
              ) : getFileType(viewingDoc.fileUrl) === "image" ? (
                <Image
                  src={viewingDoc.fileUrl}
                  alt={viewingDoc.title}
                  width={400}
                  height={400}
                  className="object-contain w-full h-96 bg-gray-100 rounded"
                  onError={() => setViewError("Failed to load image document.")}
                />
              ) : (
                <div className="text-red-500">Unsupported file type.</div>
              )}
              {viewError && <div className="text-red-500 mt-2">{viewError}</div>}
            </div>
          )}
          <DialogFooter>
            <Button onClick={() => setViewingDoc(null)} type="button">Close</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      {/* Delete Confirmation Dialog */}
      <Dialog open={!!deleteConfirmDoc} onOpenChange={open => { if (!open) return; setDeleteConfirmDoc(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Confirm Delete</DialogTitle>
          </DialogHeader>
          <div>Are you sure you want to delete this document?</div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteConfirmDoc(null)}>Cancel</Button>
            <LoadingButton
              variant="destructive"
              loading={isDeleting}
              loadingText="Deleting..."
              onClick={() => {
                if (deleteConfirmDoc) {
                  handleDelete(deleteConfirmDoc.id.toString());
                }
              }}
            >
              Delete
            </LoadingButton>
          </DialogFooter>
          {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
        </DialogContent>
      </Dialog>
        {/* Bulk Reject Confirmation Dialog */}
        <Dialog open={showBulkRejectDialog} onOpenChange={setShowBulkRejectDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Reject Selected Documents</DialogTitle>
            </DialogHeader>
            <div className="mb-4">
              <label className="block text-sm font-medium mb-1">Reason for rejection</label>
              <Input
                value={bulkRejectionReason}
                onChange={e => setBulkRejectionReason(e.target.value)}
                placeholder="Enter reason..."
                required
                autoFocus
              />
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowBulkRejectDialog(false)}>Cancel</Button>
              <LoadingButton
                variant="destructive"
                disabled={!bulkRejectionReason.trim() || isBulkRejecting}
                loading={isBulkRejecting}
                loadingText="Rejecting..."
                onClick={async () => {
                  await handleBulkReject(bulkRejectionReason);
                  setShowBulkRejectDialog(false);
                  setBulkRejectionReason("");
                }}
              >
                Reject
              </LoadingButton>
            </DialogFooter>
            {actionError && <div className="text-red-500 mt-2">{actionError}</div>}
          </DialogContent>
        </Dialog>
    </div>
    </TooltipProvider>
  );
}

export const DocumentTableSkeleton = () => (
  <div className="bg-white rounded-lg border shadow-sm">
    <div className="border-b">
      <table className="w-full">
        <thead>
          <tr>
            <th className="text-left p-4">Document</th>
            <th className="text-left p-4">Employee</th>
            <th className="text-left p-4">Date</th>
            <th className="text-left p-4">Status</th>
            <th className="text-right p-4">Actions</th>
          </tr>
        </thead>
      </table>
    </div>
    <div className="overflow-y-auto max-h-[500px]">
      <table className="w-full">
        <tbody>
          {[...Array(4)].map((_, i) => (
            <tr key={i} className="border-b">
              <td className="p-4">
                <div className="flex items-center space-x-3">
                  <Skeleton className="h-5 w-5 rounded" />
                  <div className="flex-1 min-w-0">
                    <Skeleton className="h-4 w-32 mb-1" />
                    <Skeleton className="h-3 w-16" />
                  </div>
                </div>
              </td>
              <td className="p-4 text-sm"><Skeleton className="h-4 w-24" /></td>
              <td className="p-4 text-sm"><Skeleton className="h-4 w-20" /></td>
              <td className="p-4"><Skeleton className="h-6 w-16 rounded-full" /></td>
              <td className="p-4 text-right"><Skeleton className="h-4 w-16 ml-auto" /></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  </div>
);