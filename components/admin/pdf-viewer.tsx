import { Document, Page, pdfjs } from 'react-pdf';
import { useState } from 'react';

interface PDFViewerProps {
  url: string;
}

export default function PDFViewer({ url }: PDFViewerProps) {
  const [numPages, setNumPages] = useState<number | null>(null);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="flex flex-col items-center w-full">
      <Document
        file={url}
        onLoadSuccess={({ numPages }) => setNumPages(numPages)}
        onLoadError={err => setError('Failed to load PDF')}
        loading={<div className="text-gray-400 text-center py-8">Loading PDF...</div>}
        error={<div className="text-red-500 text-center py-8">{error || 'Failed to load PDF.'}</div>}
      >
        {Array.from(new Array(numPages || 0), (el, index) => (
          <Page key={`page_${index + 1}`} pageNumber={index + 1} width={700} />
        ))}
      </Document>
    </div>
  );
} 