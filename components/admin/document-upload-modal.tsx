"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import useSWR from "swr"
import { useToast } from "@/components/ui/use-toast"
import { Info, User, FileText, Type, UploadCloud } from "lucide-react"
import { adminFetcher, fetchWithCSRF } from "@/lib/admin-api-client"

interface DocumentUploadModalProps {
  isOpen: boolean
  onClose: () => void
  onUpload: (document: any) => void
}

export default function DocumentUploadModal({ isOpen, onClose, onUpload }: DocumentUploadModalProps) {
  const [employeeId, setEmployeeId] = useState("")
  const [employeeName, setEmployeeName] = useState("")
  const [documentType, setDocumentType] = useState<string>("")
  const [title, setTitle] = useState("")
  const [description, setDescription] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [uploadedDuring, setUploadedDuring] = useState<string | null>(null)
  const [errors, setErrors] = useState<Record<string, string>>({})
  const [isUploading, setIsUploading] = useState(false)

  const { toast, dismiss } = useToast();

  // Fetch employees when modal is open
  const { data: employeeData } = useSWR(isOpen ? "/api/admin/employees?page=1&pageSize=1000" : null, adminFetcher);
  const employees = employeeData?.employees || [];

  // When employeeId changes, set employeeName
  useEffect(() => {
    if (!employeeId) return;
    const emp = employees.find((e: any) => e.id.toString() === employeeId);
    if (emp) setEmployeeName(emp.user.name);
    else setEmployeeName("");
  }, [employeeId, employees]);

  const resetForm = () => {
    setEmployeeId("")
    setEmployeeName("")
    setDocumentType("")
    setTitle("")
    setDescription("")
    setFile(null)
    setUploadedDuring(null)
    setErrors({})
  }

  const handleClose = () => {
    resetForm()
    onClose()
  }

  const validateForm = () => {
    const newErrors: Record<string, string> = {}

    if (!employeeId) newErrors.employeeId = "Employee ID is required"
    if (!employeeName) newErrors.employeeName = "Employee name is required"
    if (!documentType) newErrors.documentType = "Document type is required"
    if (!title) newErrors.title = "Title is required"
    if (!file) newErrors.file = "File is required"

    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    
    // Validate form
    if (!validateForm()) return;
    
    // Prevent multiple submissions
    if (isUploading) {
      console.log("Already uploading document, ignoring duplicate submission");
      return;
    }
    
    setIsUploading(true)
    
    // Show initial feedback toast
    const uploadingToastId = toast({
      title: 'Uploading Document',
      description: 'Please wait while your document is being uploaded...',
      variant: 'default',
    });
    
    try {
      const formData = new FormData();
      formData.append('employeeId', employeeId);
      formData.append('type', documentType);
      formData.append('title', title);
      formData.append('description', description);
      if (uploadedDuring) formData.append('uploadedDuring', uploadedDuring);
      if (file) formData.append('file', file);

      // Get CSRF token
      const csrfToken = document.cookie
        .split('; ')
        .find(row => row.startsWith('csrf-token='))
        ?.split('=')[1];

      const res = await fetch('/api/admin/documents', {
        method: 'POST',
        body: formData,
        headers: {
          'Cache-Control': 'no-cache',
          'Pragma': 'no-cache',
          'x-csrf-token': csrfToken || '',
        },
        credentials: 'include',
      });
      
      // Dismiss the uploading toast
      dismiss();
      
      if (!res.ok) {
        const error = await res.json();
        toast({
          title: 'Upload Failed',
          description: error.error || 'Failed to upload document',
          variant: 'destructive',
        });
        return;
      }
      
      const created = await res.json();
      toast({
        title: 'Document Uploaded',
        description: 'The document was uploaded successfully.',
        variant: 'default',
      });
      
      onUpload(created);
      resetForm();
    } catch (err: any) {
      // Dismiss the uploading toast
      dismiss();
      
      toast({
        title: 'Upload Failed',
        description: err.message || 'Failed to upload document',
        variant: 'destructive',
      });
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-3xl w-full max-h-[80vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">Upload New Document</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          {/* Employee Info always visible */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mx-auto">
            <div className="space-y-2">
              <Label htmlFor="employeeName" className="flex items-center gap-1">
                <User className="w-4 h-4 text-gray-500" aria-label="Employee" />
                Employee Name <span className="text-red-500">*</span>
              </Label>
              <Select value={employeeId} onValueChange={setEmployeeId}>
                <SelectTrigger id="employeeName">
                  <SelectValue placeholder="Select employee name" />
                </SelectTrigger>
                <SelectContent>
                  {employees.map((emp: any) => (
                    <SelectItem key={emp.id} value={emp.id.toString()}>
                      {emp.user.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {errors.employeeName && <p className="text-red-500 text-xs">{errors.employeeName}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="employeeId" className="flex items-center gap-1">
                <Info className="w-4 h-4 text-gray-500" aria-label="Employee ID" />
                Employee ID
              </Label>
              <Input
                id="employeeId"
                value={(() => {
                  const emp = employees.find((e: any) => e.id.toString() === employeeId);
                  return emp ? `${emp.id} | ${emp.user.email}` : "";
                })()}
                readOnly
                placeholder="Auto-filled from employee name"
                className={errors.employeeId ? "border-red-500" : "bg-gray-100 cursor-not-allowed"}
                tabIndex={-1}
                style={{ pointerEvents: 'none', userSelect: 'all' }}
              />
              {errors.employeeId && <p className="text-red-500 text-xs">{errors.employeeId}</p>}
            </div>
          </div>
          {/* Collapsible sections for the rest */}
          <Accordion type="multiple" className="w-full">
            <AccordionItem value="document-info">
              <AccordionTrigger>Document Info</AccordionTrigger>
              <AccordionContent>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mx-auto">
                  <div className="space-y-2">
                    <Label htmlFor="documentType" className="flex items-center gap-1">
                      <Type className="w-4 h-4 text-gray-500" aria-label="Document Type" />
                      Document Type <span className="text-red-500">*</span>
                    </Label>
                    {/* Only allow values from backend enum: passport, national_id */}
                    <Select value={documentType} onValueChange={setDocumentType}>
                      <SelectTrigger id="documentType" className={errors.documentType ? "border-red-500" : ""}>
                        <SelectValue placeholder="Select document type" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="passport">Passport</SelectItem>
                        <SelectItem value="national_id">National ID</SelectItem>
                      </SelectContent>
                    </Select>
                    {errors.documentType && <p className="text-red-500 text-xs">{errors.documentType}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="title" className="flex items-center gap-1">
                      <FileText className="w-4 h-4 text-gray-500" aria-label="Document Title" />
                      Document Title <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      id="title"
                      value={title}
                      onChange={(e) => setTitle(e.target.value)}
                      placeholder="Enter document title"
                      className={errors.title ? "border-red-500" : ""}
                    />
                    {errors.title && <p className="text-red-500 text-xs">{errors.title}</p>}
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="uploadedDuring" className="flex items-center gap-1">
                      <Info className="w-4 h-4 text-gray-500" aria-label="Uploaded During" />
                      Uploaded During
                    </Label>
                    <Select value={uploadedDuring || ""} onValueChange={setUploadedDuring}>
                      <SelectTrigger id="uploadedDuring">
                        <SelectValue placeholder="Select upload context (optional)" />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="Registration">Registration</SelectItem>
                        <SelectItem value="Onboarding">Onboarding</SelectItem>
                        <SelectItem value="Review">Performance Review</SelectItem>
                        <SelectItem value="Other">Other</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>
              </AccordionContent>
            </AccordionItem>
            <AccordionItem value="description">
              <AccordionTrigger>Description</AccordionTrigger>
              <AccordionContent>
                <div className="space-y-2">
                  <Label htmlFor="description" className="flex items-center gap-1">
                    <Info className="w-4 h-4 text-gray-500" aria-label="Description" />
                    Description (Optional)
                  </Label>
                  <Textarea
                    id="description"
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Enter document description"
                    rows={3}
                  />
                </div>
              </AccordionContent>
            </AccordionItem>
          </Accordion>
          {/* File Upload always visible */}
          <div className="space-y-2">
            <Label htmlFor="file" className="flex items-center gap-1">
              <UploadCloud className="w-4 h-4 text-gray-500" aria-label="Upload File" />
              Upload File <span className="text-red-500">*</span>
            </Label>
            <Input
              id="file"
              type="file"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
              className={errors.file ? "border-red-500" : ""}
            />
            {errors.file && <p className="text-red-500 text-xs">{errors.file}</p>}
          </div>
          <DialogFooter className="pt-4">
            <Button 
              type="button" 
              variant="outline" 
              onClick={handleClose}
              disabled={isUploading}
            >
              Cancel
            </Button>
            <Button 
              type="submit" 
              disabled={isUploading}
              className={isUploading ? "opacity-50 cursor-not-allowed" : ""}
            >
              {isUploading ? (
                <>
                  <span className="h-4 w-4 mr-2 animate-spin rounded-full border-2 border-current border-t-transparent" />
                  Uploading...
                </>
              ) : (
                'Upload Document'
              )}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
