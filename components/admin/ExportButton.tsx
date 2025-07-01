import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { FileText } from 'lucide-react';

interface ExportButtonProps {
  chartRef: React.RefObject<HTMLDivElement>;
  attendanceChartRef: React.RefObject<HTMLDivElement>;
  disabled: boolean;
}

export default function ExportButton({ chartRef, attendanceChartRef, disabled }: ExportButtonProps) {
  const [isExporting, setIsExporting] = useState(false);
  
  const handleExport = async () => {
    setIsExporting(true);
    try {
      alert("Your report is being generated. The download will start soon.");
      
      // Dynamically import libraries only when needed
      const html2canvasModule = await import('html2canvas');
      const html2canvas = html2canvasModule.default;
      
      let chartImage = "";
      let attendanceChartImage = "";
      
      // Generate images only if refs are available
      if (chartRef.current) {
        const canvas = await html2canvas(chartRef.current);
        chartImage = canvas.toDataURL("image/png");
      }
      
      if (attendanceChartRef.current) {
        const canvas = await html2canvas(attendanceChartRef.current);
        attendanceChartImage = canvas.toDataURL("image/png");
      }
      
      // Send to API for processing
      const res = await fetch("/api/admin/export-dashboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ chartImage, attendanceChartImage }),
      });
      
      if (!res.ok) {
        alert("Failed to export report. Please try again.");
        return;
      }
      
      // Download the file
      const blob = await res.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "dashboard-report.pdf";
      document.body.appendChild(a);
      a.click();
      a.remove();
      window.URL.revokeObjectURL(url);
      
    } catch (error) {
      console.error("Export error:", error);
      alert("Failed to export report. Please try again.");
    } finally {
      setIsExporting(false);
    }
  };
  
  return (
    <Button
      variant="outline"
      disabled={disabled || isExporting}
      onClick={handleExport}
    >
      <FileText className="mr-2 h-4 w-4" />
      {isExporting ? 'Exporting...' : 'Export Reports'}
    </Button>
  );
} 