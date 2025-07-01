"use client"

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText, Download } from 'lucide-react';
import { useToast } from '@/components/ui/use-toast';

interface ExportProfileButtonProps {
  employee: any;
  type: 'pdf' | 'excel';
  disabled?: boolean;
}

export default function ExportProfileButton({ employee, type, disabled = false }: ExportProfileButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  const { toast } = useToast();

  const handleExportPDF = async () => {
    if (!employee) return;
    
    try {
      const { default: jsPDF } = await import('jspdf');
      const { default: html2canvas } = await import('html2canvas');
      
      const html = `
        <div style="font-family: Arial, sans-serif; color: #222; padding: 8px; width: 400px; font-size: 10px;">
          <div style="border-bottom: 2px solid #6366f1; padding-bottom: 6px; margin-bottom: 10px;">
            <h1 style="margin: 0; color: #4f46e5; font-size: 1.2rem;">${employee.user?.name}</h1>
            <div style="font-size: 0.9rem; color: #555; margin-bottom: 2px;">${employee.user?.email}</div>
            <div style="font-size: 0.85rem; color: #666;">${employee.position} | ${employee.city} | Status: ${employee.user?.status}</div>
            <div style="font-size: 0.8rem; color: #888;">Joined: ${new Date(employee.joinDate).toLocaleDateString()}</div>
          </div>
          <h2 style="color: #6366f1; border-bottom: 1px solid #e0e7ff; padding-bottom: 1px; font-size: 1rem;">Sales</h2>
          <table style="width: 380px; table-layout: fixed; border-collapse: collapse; margin-bottom: 8px; font-size: 9px;">
            <thead>
              <tr style="background: #f3f4f6; color: #374151;">
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Date</th>
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Amount</th>
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Notes</th>
              </tr>
            </thead>
            <tbody>
              ${employee.sales.map((sale: any, i: number) => `
                <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${new Date(sale.date).toLocaleDateString()}</td>
                  <td style="padding: 2px; border: 1px solid #e5e7eb; color: #10b981; font-weight: bold;">$${sale.amount}</td>
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${sale.notes || ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <h2 style="color: #6366f1; border-bottom: 1px solid #e0e7ff; padding-bottom: 1px; font-size: 1rem;">Attendance</h2>
          <table style="width: 380px; table-layout: fixed; border-collapse: collapse; margin-bottom: 8px; font-size: 9px;">
            <thead>
              <tr style="background: #f3f4f6; color: #374151;">
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Date</th>
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Check-in</th>
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Check-out</th>
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Status</th>
              </tr>
            </thead>
            <tbody>
              ${employee.attendance.map((att: any, i: number) => `
                <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${new Date(att.date).toLocaleDateString()}</td>
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-'}</td>
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${att.status || '-'}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
          <h2 style="color: #6366f1; border-bottom: 1px solid #e0e7ff; padding-bottom: 1px; font-size: 1rem;">Documents</h2>
          <table style="width: 380px; table-layout: fixed; border-collapse: collapse; margin-bottom: 8px; font-size: 9px;">
            <thead>
              <tr style="background: #f3f4f6; color: #374151;">
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Title</th>
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Type</th>
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Description</th>
                <th style="padding: 2px; border: 1px solid #e5e7eb;">Uploaded</th>
              </tr>
            </thead>
            <tbody>
              ${employee.documents.map((doc: any, i: number) => `
                <tr style="background: ${i % 2 === 0 ? '#fff' : '#f9fafb'};">
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${doc.title}</td>
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${doc.type}</td>
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${doc.description || ''}</td>
                  <td style="padding: 2px; border: 1px solid #e5e7eb;">${doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ''}</td>
                </tr>
              `).join('')}
            </tbody>
          </table>
        </div>
      `;
      
      const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
      await pdf.html(html, {
        margin: [8, 8, 8, 8],
        autoPaging: 'text',
        x: 0,
        y: 0,
        width: 400,
        windowWidth: 400,
        html2canvas: { scale: 1 },
        callback: function (doc) {
          doc.save(`${employee.user?.name}-profile.pdf`);
        }
      });
    } catch (error) {
      console.error("Error generating PDF:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate PDF. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExportExcel = async () => {
    if (!employee) return;
    
    try {
      const XLSX = await import('xlsx');
      
      // Personal Info sheet
      const personalInfo = [
        ["Name", employee.user?.name],
        ["Email", employee.user?.email],
        ["Phone Number", employee.user?.phoneNumber || '-'],
        ["Position", employee.position],
        ["City", employee.city],
        ["Status", employee.user?.status],
        ["Join Date", new Date(employee.joinDate).toLocaleDateString()],
      ];
      
      // Sales sheet
      const salesSheet = [
        ["Date", "Amount", "Notes"],
        ...employee.sales.map((sale: any) => [
          new Date(sale.date).toLocaleDateString(),
          sale.amount,
          sale.notes || ""
        ])
      ];
      
      // Attendance sheet
      const attendanceSheet = [
        ["Date", "Check-in", "Check-out", "Status"],
        ...employee.attendance.map((att: any) => [
          new Date(att.date).toLocaleDateString(),
          att.checkIn ? new Date(att.checkIn).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          att.checkOut ? new Date(att.checkOut).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : '-',
          att.status || "-"
        ])
      ];
      
      // Documents sheet
      const documentsSheet = [
        ["Title", "Type", "Description", "Uploaded"],
        ...employee.documents.map((doc: any) => [
          doc.title,
          doc.type,
          doc.description || "",
          doc.uploadedAt ? new Date(doc.uploadedAt).toLocaleDateString() : ""
        ])
      ];
      
      // Create workbook
      const wb = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(personalInfo), "Personal Info");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(salesSheet), "Sales");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(attendanceSheet), "Attendance");
      XLSX.utils.book_append_sheet(wb, XLSX.utils.aoa_to_sheet(documentsSheet), "Documents");
      
      // Download
      XLSX.writeFile(wb, `${employee.user?.name.replace(/\s+/g, '_')}_profile.xlsx`);
    } catch (error) {
      console.error("Error generating Excel:", error);
      toast({
        title: "Export Failed",
        description: "Failed to generate Excel file. Please try again.",
        variant: "destructive",
      });
    }
  };

  const handleExport = async () => {
    setIsExporting(true);
    try {
      if (type === 'pdf') {
        await handleExportPDF();
      } else if (type === 'excel') {
        await handleExportExcel();
      }
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <Button
      variant="outline"
      size="sm"
      disabled={disabled || isExporting}
      onClick={handleExport}
    >
      {type === 'pdf' ? (
        <FileText className="mr-2 h-4 w-4" />
      ) : (
        <Download className="mr-2 h-4 w-4" />
      )}
      {isExporting ? 'Exporting...' : type === 'pdf' ? 'Export PDF' : 'Export Excel'}
    </Button>
  );
} 