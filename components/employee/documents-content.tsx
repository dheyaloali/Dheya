"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { format } from "date-fns"
import { Check, Download, Eye, FileText, Upload, X, Info } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Skeleton } from "@/components/ui/skeleton"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Textarea } from "@/components/ui/textarea"
import { Badge } from "@/components/ui/badge"
import useSWR from 'swr';
import { toast } from "@/components/ui/use-toast";
import { useTranslations } from "next-intl";

export function EmployeeDocumentsContent() {
  const t = useTranslations('Documents');
  const [isUploadDialogOpen, setIsUploadDialogOpen] = useState(false)
  const [uploadForm, setUploadForm] = useState({
    title: "",
    type: "",
    description: "",
    file: null as File | null,
  })
  // SWR fetch for documents
  const { data: docsData, isLoading: docsLoading, mutate: mutateDocs } = useSWR('/api/employee/documents', (url) => fetch(url).then(res => res.json()));
  const documents = docsData?.documents || [];
  // SWR fetch for delete requests
  const { data: reqsData, isLoading: reqsLoading, mutate: mutateReqs } = useSWR('/api/employee/documents/delete-requests', (url) => fetch(url).then(res => res.json()));
  const deleteRequests = reqsData?.requests || [];
  // Add state for request delete dialog
  const [requestingDoc, setRequestingDoc] = useState<any | null>(null);
  const [reason, setReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [uploadError, setUploadError] = useState("");
  const [showReasonDialog, setShowReasonDialog] = useState<{ open: boolean, reason: string | null }>({ open: false, reason: null });
  // Add SWR fetch for employee profile
  const { data: employeeData, isLoading: employeeLoading } = useSWR('/api/employee/profile', (url) => fetch(url).then(res => res.json()));
  const employee = employeeData?.employee;
  const [deleteRequestError, setDeleteRequestError] = useState("");
  const [isUploading, setIsUploading] = useState(false);

  const allowedMimeTypes = [
    "image/jpeg",
    "image/png",
    "image/webp",
    "application/pdf"
  ];

  const validateTitle = (title: string) => {
    if (!title || title.length < 2) return t('titleTooShort');
    if (title.length > 100) return t('titleTooLong');
    if (!/[a-zA-Z]/.test(title)) return t('titleMustContainLetter');
    if (!/^[a-zA-Z0-9 ]+$/.test(title)) return t('titleInvalidChars');
    return null;
  };
  const validateDescription = (desc: string) => {
    if (desc && desc.length > 300) return t('descriptionTooLong');
    return null;
  };
  const validateReason = (reason: string) => {
    if (!reason || reason.length < 5) return t('reasonTooShort');
    if (reason.length > 300) return t('reasonTooLong');
    if (!/[a-zA-Z]/.test(reason)) return t('reasonMustContainLetter');
    if (!/^[a-zA-Z0-9 .,!?()@\-_'"\n]+$/.test(reason)) return t('reasonInvalidChars');
    return null;
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      if (file.size > 5 * 1024 * 1024) {
        setUploadError(t('fileSizeError'));
        return;
      }
      setUploadForm({
        ...uploadForm,
        file,
      })
    }
  }

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isUploading) return;
    setIsUploading(true);
    setUploadError("");
    const titleError = validateTitle(uploadForm.title);
    if (titleError) {
      setUploadError(titleError);
      setIsUploading(false);
      return;
    }
    const descError = validateDescription(uploadForm.description);
    if (descError) {
      setUploadError(descError);
      setIsUploading(false);
      return;
    }
    if (!uploadForm.type || !["passport", "national_id"].includes(uploadForm.type)) {
      setUploadError(t('fileTypeError'));
      setIsUploading(false);
      return;
    }
    if (!uploadForm.file) {
      setUploadError(t('uploadFailed'));
      setIsUploading(false);
      return;
    }
    if (!allowedMimeTypes.includes(uploadForm.file.type)) {
      setUploadError(t('fileTypeError'));
      setIsUploading(false);
      return;
    }
    if (uploadForm.file.size > 5 * 1024 * 1024) {
      setUploadError(t('fileSizeError'));
      setIsUploading(false);
      return;
    }
    // Upload to backend
    const formData = new FormData();
    formData.append("title", uploadForm.title);
    formData.append("type", uploadForm.type);
    formData.append("description", uploadForm.description);
    formData.append("file", uploadForm.file);
    try {
      const res = await fetch("/api/employee/documents", {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        toast({ title: t('uploadSuccess'), description: t('uploadSuccess') });
        mutateDocs();
        setUploadForm({ title: "", type: "", description: "", file: null });
        setIsUploadDialogOpen(false);
      } else {
        const data = await res.json();
        if (data.error && data.error.includes('Too many uploads')) {
          setUploadError(t('rateLimitError'));
        } else if (data.error && data.error.includes('File size')) {
          setUploadError(t('fileSizeError'));
        } else if (data.error && data.error.includes('Only image or PDF')) {
          setUploadError(t('fileTypeError'));
        } else {
          setUploadError(t('uploadFailed'));
        }
        toast({ title: t('uploadFailed'), description: uploadError || t('uploadFailed'), variant: "destructive" });
      }
    } catch (err) {
      setUploadError(t('uploadFailed'));
      toast({ title: t('uploadFailed'), description: t('uploadFailed'), variant: "destructive" });
    } finally {
      setIsUploading(false);
    }
  };

  // Helper to get request for a document
  function getDeleteRequest(docId: number) {
    return deleteRequests.find((r: any) => r.documentId === docId);
  }

  const handleDeleteRequest = async (requestId: number) => {
    // Optimistically update UI
    mutateReqs((currentData: any) => {
      if (!currentData || !currentData.requests) return currentData;
      return {
        ...currentData,
        requests: currentData.requests.filter((r: any) => r.id !== requestId),
      };
    }, false);

    // Call the API
    const res = await fetch(`/api/employee/documents/delete-requests/${requestId}`, {
      method: 'DELETE',
    });

    if (res.ok) {
      toast({ title: "Delete request removed!", description: "Your delete request has been deleted." });
      mutateReqs();
      mutateDocs();
    } else {
      const data = await res.json();
      toast({ title: "Failed to delete request", description: data.error || 'Could not delete request', variant: 'destructive' });
      mutateReqs(); // Revert optimistic update
    }
  };

  // Show loading skeleton while employee is loading
  if (employeeLoading) {
    return (
      <div className="w-full p-4 md:p-6 pb-20 pt-4 md:pt-0">
        <Skeleton className="h-10 w-40 rounded mb-4" />
        <Skeleton className="h-8 w-1/2 rounded mb-2" />
        <Skeleton className="h-10 w-full rounded mb-2" />
        <Skeleton className="h-10 w-full rounded mb-2" />
        <Skeleton className="h-24 w-full rounded" />
      </div>
    );
  }
  // If employee is not found, show a friendly message and disable upload
  if (!employee) {
    return (
      <div className="w-full p-4 md:p-6 pb-20 pt-4 md:pt-0 text-center text-muted-foreground">
        <p className="mb-4">{t('settingUpProfile')}</p>
        <Skeleton className="h-10 w-40 rounded mx-auto" />
      </div>
    );
  }

  return (
    <div className="w-full p-4 md:p-6 pb-20 pt-4 md:pt-0">
      <div className="sticky top-0 bg-background z-10 pt-4 pb-4 mb-4 border-b w-full">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold">{t('documents')}</h1>
            <p className="text-muted-foreground">{t('manageAndUpload')}</p>
          </div>
          {docsLoading ? (
            <Skeleton className="h-10 w-40 rounded" />
          ) : (
          <Dialog open={isUploadDialogOpen} onOpenChange={setIsUploadDialogOpen}>
            <DialogTrigger asChild>
              <Button className="gap-2">
                <Upload className="h-4 w-4" />
                {t('uploadDocument')}
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[500px]">
                {docsLoading ? (
                  <div className="space-y-4">
                    <Skeleton className="h-8 w-1/2 rounded" />
                    <Skeleton className="h-10 w-full rounded" />
                    <Skeleton className="h-10 w-full rounded" />
                    <Skeleton className="h-24 w-full rounded" />
                    <Skeleton className="h-10 w-1/3 rounded" />
                  </div>
                ) : (
              <form onSubmit={handleUpload}>
                <DialogHeader>
                  <DialogTitle>{t('uploadNewDocument')}</DialogTitle>
                  <DialogDescription>{t('uploadDescription')}</DialogDescription>
                </DialogHeader>
                <div className="grid gap-4 py-4">
                  <div className="grid gap-2">
                    <Label htmlFor="title">{t('title')}</Label>
                    <Input
                      id="title"
                      value={uploadForm.title}
                      onChange={(e) => setUploadForm({ ...uploadForm, title: e.target.value })}
                      required
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="type">{t('type')}</Label>
                    <Select
                      value={uploadForm.type}
                      onValueChange={(value) => setUploadForm({ ...uploadForm, type: value })}
                      required
                    >
                      <SelectTrigger id="type">
                        <SelectValue placeholder={t('selectType')} />
                      </SelectTrigger>
                      <SelectContent>
                            <SelectItem value="passport">{t('passport')}</SelectItem>
                            <SelectItem value="national_id">{t('nationalId')}</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="description">{t('description')}</Label>
                    <Textarea
                      id="description"
                      placeholder={t('descriptionPlaceholder')}
                      value={uploadForm.description}
                      onChange={(e) => setUploadForm({ ...uploadForm, description: e.target.value })}
                    />
                  </div>
                  <div className="grid gap-2">
                    <Label htmlFor="file">{t('file')}</Label>
                        <Input id="file" type="file" accept="image/jpeg,image/png,image/webp,application/pdf" onChange={handleFileChange} required />
                  </div>
                </div>
                    {uploadError && <div className="text-red-500 text-sm mb-2">{uploadError}</div>}
                <DialogFooter>
                  <Button type="submit" disabled={isUploading}>
                    {isUploading ? t('uploading') : t('uploadDocument')}
                  </Button>
                </DialogFooter>
              </form>
                )}
            </DialogContent>
          </Dialog>
          )}
        </div>
      </div>

      {/* Documents table */}
      <Card>
        <CardHeader>
          <CardTitle>{t('documents')}</CardTitle>
          <CardDescription>Documents you have uploaded for review and approval</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="rounded-md border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t('title')}</TableHead>
                  <TableHead>{t('type')}</TableHead>
                  <TableHead>{t('uploadDate')}</TableHead>
                  <TableHead>{t('status')}</TableHead>
                  <TableHead>{t('actions')}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {(docsLoading || reqsLoading)
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <TableRow key={index}>
                        <TableCell><Skeleton className="h-5 w-40" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-24" /></TableCell>
                        <TableCell><Skeleton className="h-5 w-20" /></TableCell>
                        <TableCell><Skeleton className="h-8 w-20" /></TableCell>
                      </TableRow>
                    ))
                  : documents.length === 0 ? (
                      <TableRow>
                        <TableCell colSpan={5} className="text-center py-8">
                          <div className="flex flex-col items-center justify-center gap-2">
                            <FileText className="h-8 w-8 text-muted-foreground" />
                            <span className="text-muted-foreground">{t('noDocumentsFound')}</span>
                          </div>
                        </TableCell>
                      </TableRow>
                    ) : (
                      documents.map((doc: any) => {
                        const req = getDeleteRequest(doc.id);
                        return (
                      <TableRow key={doc.id}>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <FileText className="h-4 w-4 text-muted-foreground" />
                            <span className="font-medium">{doc.title}</span>
                          </div>
                        </TableCell>
                        <TableCell>{doc.type}</TableCell>
                            <TableCell>{format(new Date(doc.uploadedAt), "MMM dd, yyyy")}</TableCell>
                        <TableCell>
                          <StatusBadge status={doc.status} />
                              {req && (
                                <div className="mt-1">
                                  <StatusBadge status={req.status.charAt(0).toUpperCase() + req.status.slice(1)} />
                                </div>
                              )}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Button variant="ghost" size="icon" asChild>
                              <a href={doc.fileUrl} target="_blank" rel="noopener noreferrer">
                                <Eye className="h-4 w-4" />
                                <span className="sr-only">View</span>
                              </a>
                            </Button>
                            <Button variant="ghost" size="icon" asChild>
                              <a href={doc.fileUrl} download>
                                <Download className="h-4 w-4" />
                                <span className="sr-only">Download</span>
                              </a>
                            </Button>
                                {/* Request Delete button or status */}
                                {!req || req.status === 'rejected' ? (
                                  <Button
                                    variant="destructive"
                                    size="sm"
                                    onClick={() => { setRequestingDoc(doc); setReason(''); }}
                                    disabled={!!req && req.status === 'pending'}
                                  >
                                    Request Delete
                                  </Button>
                                ) : req.status === 'pending' ? (
                                  <>
                                    <Badge variant="outline" className="text-amber-500 border-amber-200 bg-amber-50 w-fit">Pending</Badge>
                                    <Button variant="ghost" size="icon" title="View Reason" onClick={() => setShowReasonDialog({ open: true, reason: req.reason })}>
                                      <Info className="h-4 w-4 text-blue-500" />
                                    </Button>
                                  </>
                                ) : req.status === 'approved' ? (
                                  <Badge variant="outline" className="text-green-500 border-green-200 bg-green-50 w-fit">Approved</Badge>
                                ) : null}
                                {/* Show rejection reason for rejected documents */}
                                {doc.status === 'Rejected' && doc.rejectionReason && (
                                  <Button variant="ghost" size="icon" title="View Rejection Reason" onClick={() => setShowReasonDialog({ open: true, reason: doc.rejectionReason ?? null })}>
                                    <Info className="h-4 w-4 text-red-500" />
                                  </Button>
                                )}
                                {/* Allow re-upload for rejected documents */}
                                {doc.status === 'Rejected' && (
                                  <Button
                                    variant="outline"
                                    size="sm"
                                    className="ml-2"
                                    onClick={() => {
                                      setUploadForm({ ...uploadForm, type: doc.type, title: doc.title, description: doc.description || "" });
                                      setIsUploadDialogOpen(true);
                                    }}
                                  >
                                    Re-upload
                                  </Button>
                                )}
                          </div>
                        </TableCell>
                      </TableRow>
                        );
                      })
                    )}
              </TableBody>
            </Table>
          </div>
        </CardContent>
      </Card>
      {/* Request Delete Dialog */}
      <Dialog open={!!requestingDoc} onOpenChange={open => { if (!open) setRequestingDoc(null); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t('requestDeleteTitle')}</DialogTitle>
            <DialogDescription>{t('requestDeleteDesc')}</DialogDescription>
          </DialogHeader>
          <form onSubmit={async e => {
            e.preventDefault();
            const reasonError = validateReason(reason);
            if (reasonError) {
              setDeleteRequestError(reasonError);
              return;
            }
            setDeleteRequestError("");
            setSubmitting(true);
            const res = await fetch(`/api/employee/documents/${requestingDoc.id}/request-delete`, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ reason }),
            });
            setSubmitting(false);
            if (res.ok) {
              toast({ title: "Delete request submitted!", description: "Your request will be reviewed by an admin." });
              setRequestingDoc(null);
              mutateReqs();
              mutateDocs();
            } else {
              const data = await res.json();
              toast({ title: "Delete request failed", description: data.error || 'Failed to request delete', variant: 'destructive' });
            }
          }}>
            <div className="mb-4">
              <Label htmlFor="reason">{t('reasonLabel')}</Label>
              <Textarea
                id="reason"
                value={reason}
                onChange={e => setReason(e.target.value)}
                aria-required="true"
                minLength={5}
                placeholder={t('reasonPlaceholder')}
              />
            </div>
            {deleteRequestError && <div className="text-red-500 text-sm mb-2">{deleteRequestError}</div>}
            <DialogFooter>
              <Button variant="outline" type="button" onClick={() => setRequestingDoc(null)}>Cancel</Button>
              <Button type="submit" disabled={submitting || reason.length < 5}>{submitting ? 'Submitting...' : 'Submit Request'}</Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      {/* Reason Dialog for delete request */}
      <Dialog open={showReasonDialog.open} onOpenChange={open => { if (!open) setShowReasonDialog({ open: false, reason: null }); }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Request Reason</DialogTitle>
          </DialogHeader>
          <div className="py-2 text-sm text-muted-foreground">
            {showReasonDialog.reason}
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowReasonDialog({ open: false, reason: null })}>Close</Button>
            <Button
              variant="destructive"
              onClick={async () => {
                if (!showReasonDialog.reason) return;
                // Find the request object by reason (assume only one per doc per day)
                const req = deleteRequests.find((r: any) => r.reason === showReasonDialog.reason);
                if (!req) return;
                await handleDeleteRequest(req.id);
                setShowReasonDialog({ open: false, reason: null });
              }}
            >
              Delete Request
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

function StatusBadge({ status }: { status: string }) {
  switch (status) {
    case "Approved":
      return (
        <Badge variant="outline" className="text-green-500 border-green-200 bg-green-50 flex items-center gap-1 w-fit">
          <Check className="h-3 w-3" />
          {status}
        </Badge>
      )
    case "Pending":
      return (
        <Badge variant="outline" className="text-amber-500 border-amber-200 bg-amber-50 w-fit">
          {status}
        </Badge>
      )
    case "Rejected":
      return (
        <Badge variant="outline" className="text-red-500 border-red-200 bg-red-50 flex items-center gap-1 w-fit">
          <X className="h-3 w-3" />
          {status}
        </Badge>
      )
    default:
      return <Badge variant="outline">{status}</Badge>
  }
}
