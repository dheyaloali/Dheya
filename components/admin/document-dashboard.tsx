"use client"

import React, { useState, useEffect } from "react"
import { Search } from "lucide-react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import DocumentTable, { Document, DocumentTableSkeleton } from "./document-table"
import DocumentFilters from "./document-filters"
import DocumentUploadModal from "./document-upload-modal"
import type { DocumentStatus } from "@/lib/types"
import { useRouter, useSearchParams } from "next/navigation"
import { useToast } from "@/components/ui/use-toast"
import useSWR from "swr"
import dynamic from "next/dynamic"
import { Dialog } from "@/components/ui/dialog"
import { X } from "lucide-react"
import DocumentDeleteRequestsTable from "./document-delete-requests-table"

const PDFViewer = dynamic<{ url: string }>(() => import("./pdf-viewer"), { ssr: false });

export default function DocumentDashboard() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { toast } = useToast();
  
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedStatus, setSelectedStatus] = useState<DocumentStatus | "All">("All");
  const [selectedTypes, setSelectedTypes] = useState<string[]>([]);
  const [isRegistrationOnly, setIsRegistrationOnly] = useState(false);
  const [isUploadModalOpen, setIsUploadModalOpen] = useState(false);
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);
  // Debounce search term
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [selectedDocument, setSelectedDocument] = useState<Document | null>(null);
  const [activeTab, setActiveTab] = useState<'documents' | 'deleteRequests'>('documents');

  React.useEffect(() => {
    const timeout = setTimeout(() => setDebouncedSearch(searchTerm), 400);
    return () => clearTimeout(timeout);
  }, [searchTerm]);

  // Add this useEffect to reset page on filter change
  useEffect(() => {
    setPage(1);
  }, [selectedStatus, selectedTypes, isRegistrationOnly, debouncedSearch]);

  // Build query params
  const params = new URLSearchParams();
  params.append("page", String(page));
  params.append("limit", String(pageSize));
  if (selectedStatus !== "All") params.append("status", selectedStatus);
  if (debouncedSearch) params.append("search", debouncedSearch);
  if (selectedTypes.length > 0) params.append("types", selectedTypes.join(","));
  if (isRegistrationOnly) params.append("isRegistrationDocument", "true");
  const url = `/api/admin/documents?${params.toString()}`;
  
  // Debug logs for filter values
  console.log("Filter values:", {
    selectedStatus,
    selectedTypes,
    isRegistrationOnly,
    debouncedSearch,
    url
  });
  
  console.log(url); // Debug: log the SWR key

  const { data, error, isLoading, mutate } = useSWR(url, (url) => fetch(url).then(res => {
    if (!res.ok) throw new Error("Failed to fetch documents");
    return res.json();
  }));
  // Filter out documents of type 'report' and ensure id is a number
  const documents: Document[] = (data?.documents || [])
    .filter((doc: any) => doc.type !== 'report')
    .map((doc: any) => ({
      ...doc,
      id: Number(doc.id),
      fileUrl: doc.fileUrl ? String(doc.fileUrl) : "",
    }));
  const pagination = data?.pagination || { page: 1, limit: pageSize, total: 0, totalPages: 0 };

  // Handle search with debounce
  useEffect(() => {
    const timeoutId = setTimeout(() => {
      if (page !== 1) {
        // Reset to page 1 when search term changes
        router.push(`?page=1`);
      } else {
        mutate();
      }
    }, 500);
    
    return () => clearTimeout(timeoutId);
  }, [searchTerm]);

  // Handle document actions
  const handleDownload = (id: string) => {
    const document = documents.find((doc) => doc.id.toString() === id);
    if (document && document.fileUrl) {
      window.open(document.fileUrl, '_blank');
    }
  };

  // Track deleting state to prevent multiple submissions
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const handleDelete = async (id: string) => {
    // Prevent multiple delete operations on the same document
    if (deletingId === id) {
      console.log("Already deleting document, ignoring duplicate request");
      return;
    }
    
    setDeletingId(id);
    
    try {
      // Show immediate feedback toast
      toast({
        title: "Deleting document",
        description: "Please wait...",
      });
      
      const response = await fetch(`/api/admin/documents/${id}`, {
        method: "DELETE",
        headers: {
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        }
      });
      
      if (!response.ok) {
        toast({ title: "Delete Failed", description: "Could not delete the document. Please try again.", variant: "destructive" });
        return;
      }
      
      await mutate();
      toast({ title: "Document Deleted", description: "The document was deleted successfully." });
    } catch {
      toast({ title: "Delete Failed", description: "Could not delete the document. Please try again.", variant: "destructive" });
    } finally {
      setDeletingId(null);
    }
  };

  // Track status change operations
  const [changingStatusId, setChangingStatusId] = useState<string | null>(null);

  // Approve/Reject handler for DocumentTable
  const handleStatusChange = async (id: string, status: DocumentStatus, reason?: string) => {
    // Prevent multiple status change operations on the same document
    if (changingStatusId === id) {
      console.log("Already changing document status, ignoring duplicate request");
      return;
    }
    
    setChangingStatusId(id);
    
    try {
      // Show immediate feedback toast
      toast({
        title: `${status === "Approved" ? "Approving" : status === "Rejected" ? "Rejecting" : "Updating"} document`,
        description: "Please wait...",
      });
      
      const response = await fetch(`/api/admin/documents/${id}`, {
        method: "PUT",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        body: JSON.stringify(reason ? { status, rejectionReason: reason } : { status }),
      });
      
      if (!response.ok) {
        toast({ title: "Status Update Failed", description: "Could not update document status. Please try again.", variant: "destructive" });
        return;
      }
      
      await mutate();
      toast({
        title: status === "Approved" ? "Document Approved" : status === "Rejected" ? "Document Rejected" : "Status Updated",
        description: status === "Approved"
          ? "The document was approved successfully."
          : status === "Rejected"
          ? "The document was rejected."
          : "Document status updated successfully.",
      });
    } catch {
      toast({ title: "Status Update Failed", description: "Could not update document status. Please try again.", variant: "destructive" });
    } finally {
      setChangingStatusId(null);
    }
  };

  // Optionally, wrap filter handlers to reset page
  const handleStatusChangeWrapper = (status: DocumentStatus | "All") => {
    setSelectedStatus(status);
    setPage(1);
    // Explicitly trigger a data refresh when filter changes
    mutate();
  };
  const handleTypesChange = (types: string[]) => {
    setSelectedTypes(types);
    setPage(1);
    // Explicitly trigger a data refresh when filter changes
    mutate();
  };
  const handleRegistrationChange = (val: boolean) => {
    setIsRegistrationOnly(val);
    setPage(1);
    // Explicitly trigger a data refresh when filter changes
    mutate();
  };

  // Track upload operation state
  const [isUploading, setIsUploading] = useState(false);

  const handleUploadDocument = async (document: any) => {
    // Prevent multiple upload operations
    if (isUploading) {
      console.log("Already uploading document, ignoring duplicate request");
      return;
    }
    
    setIsUploading(true);
    
    try {
      // Show immediate feedback toast
      toast({
        title: "Uploading document",
        description: "Please wait...",
      });
      
      const response = await fetch("/api/admin/documents", {
        method: "POST",
        headers: { 
          "Content-Type": "application/json",
          "Cache-Control": "no-cache",
          "Pragma": "no-cache"
        },
        body: JSON.stringify(document),
      });
      
      if (!response.ok) {
        throw new Error("Failed to upload document");
      }
      
      mutate();
      setIsUploadModalOpen(false);
      toast({ title: "Document Uploaded", description: "The document was uploaded successfully." });
    } catch (err) {
      toast({ title: "Upload Failed", description: "Failed to upload document. Please try again.", variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  const handlePageChange = (newPage: number) => {
    setPage(newPage);
  };

  return (
    <div className="container mx-auto py-6">
      <div className="flex flex-col space-y-8">
        {/* Tab Switch */}
        <div className="flex items-center gap-4 mb-2">
          <button
            className={`px-4 py-2 rounded font-semibold border-b-2 transition-colors ${activeTab === 'documents' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-700'}`}
            onClick={() => setActiveTab('documents')}
          >
            Documents
          </button>
          <button
            className={`px-4 py-2 rounded font-semibold border-b-2 transition-colors ${activeTab === 'deleteRequests' ? 'border-blue-600 text-blue-700' : 'border-transparent text-gray-500 hover:text-blue-700'}`}
            onClick={() => setActiveTab('deleteRequests')}
          >
            Delete Requests
          </button>
        </div>
        {/* Tab Content */}
        {activeTab === 'documents' ? (
          <>
            {/* Existing Documents Table UI */}
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-bold tracking-tight">Documents</h1>
              <Button onClick={() => setIsUploadModalOpen(true)}>Upload Document</Button>
            </div>
            <div className="flex items-center space-x-2">
              <Search className="h-5 w-5 text-gray-500" />
              <Input
                placeholder="Search documents..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full max-w-sm"
              />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
              <div className="md:col-span-1">
                <DocumentFilters
                  selectedStatus={selectedStatus}
                  onStatusChange={handleStatusChangeWrapper}
                  selectedTypes={selectedTypes}
                  onTypesChange={handleTypesChange}
                  isRegistrationOnly={isRegistrationOnly}
                  onRegistrationFilterChange={handleRegistrationChange}
                />
              </div>
              <div className="md:col-span-3">
                {isLoading ? (
                  <DocumentTableSkeleton />
                ) : error ? (
                  <div className="min-h-[240px] flex flex-col items-center justify-center border rounded bg-white">
                    <div className="text-4xl text-red-300 mb-2">❌</div>
                    <div className="text-lg font-semibold text-red-500 mb-1">{error.message || String(error)}</div>
                    <div className="text-sm text-gray-400">Try refreshing or adjusting your filters.</div>
                  </div>
                ) : documents.length === 0 ? (
                  <div className="min-h-[240px] flex flex-col items-center justify-center border rounded bg-white">
                    <div className="text-4xl text-gray-300 mb-2">📄</div>
                    <div className="text-lg font-semibold text-gray-500 mb-1">No documents found</div>
                    <div className="text-sm text-gray-400">Try adjusting your filters or search.</div>
                  </div>
                ) : (
                  <>
                    <DocumentTable
                      documents={documents}
                      onDownload={handleDownload}
                      onDelete={handleDelete}
                      onStatusChange={handleStatusChange}
                      onNameClick={setSelectedDocument}
                    />
                    {/* Pagination Controls */}
                    <div className="flex flex-col md:flex-row justify-between items-center mt-4 gap-2">
                      <div className="flex items-center gap-2">
                        <span>Rows per page:</span>
                        <select
                          className="border rounded px-2 py-1 text-sm"
                          value={pageSize}
                          onChange={e => { setPageSize(Number(e.target.value)); setPage(1); }}
                        >
                          {[5, 10, 20, 25, 50, 100].map(size => (
                            <option key={size} value={size}>{size}</option>
                          ))}
                        </select>
                      </div>
                      <div className="text-xs text-gray-500">Page {pagination.page} of {pagination.totalPages}</div>
                      <div className="flex gap-2">
                        <button
                          className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                          onClick={() => setPage(1)}
                          disabled={pagination.page === 1}
                        >First</button>
                        <button
                          className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                          onClick={() => setPage(p => Math.max(1, p - 1))}
                          disabled={pagination.page === 1}
                        >Prev</button>
                        <button
                          className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                          onClick={() => setPage(p => Math.min(pagination.totalPages, p + 1))}
                          disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
                        >Next</button>
                        <button
                          className="px-2 py-1 rounded border text-xs disabled:opacity-50"
                          onClick={() => setPage(pagination.totalPages)}
                          disabled={pagination.page === pagination.totalPages || pagination.totalPages === 0}
                        >Last</button>
                      </div>
                    </div>
                    {/* PDF Preview Modal */}
                    <Dialog open={!!selectedDocument} onOpenChange={() => setSelectedDocument(null)}>
                      {selectedDocument && (
                        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-40">
                          <div className="bg-white rounded-lg shadow-lg max-w-3xl w-full max-h-[90vh] flex flex-col relative">
                            <button className="absolute top-2 right-2 p-2" onClick={() => setSelectedDocument(null)}>
                              <X className="h-6 w-6 text-gray-500" />
                            </button>
                            <div className="p-4 border-b font-semibold text-lg truncate">{selectedDocument.title}</div>
                            <div className="flex-1 overflow-auto p-4">
                              <PDFViewer url={selectedDocument.fileUrl} />
                            </div>
                          </div>
                        </div>
                      )}
                    </Dialog>
                  </>
                )}
              </div>
            </div>
            <DocumentUploadModal
              isOpen={isUploadModalOpen}
              onClose={() => setIsUploadModalOpen(false)}
              onUpload={(doc) => {
                mutate();
                setIsUploadModalOpen(false);
              }}
            />
          </>
        ) : (
          <DocumentDeleteRequestsTable />
        )}
      </div>
    </div>
  );
}