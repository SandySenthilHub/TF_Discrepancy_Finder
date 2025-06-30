import React, { useState, useEffect } from 'react';
import { X, ZoomIn, ZoomOut, RotateCw, Download, Eye, RefreshCw } from 'lucide-react';
import { useDocumentStore } from '../../store/documentStore';
import { ocrAPI } from '../../services/api';

import { Document as PDFDocument, Page, pdfjs } from 'react-pdf';
import 'react-pdf/dist/esm/Page/AnnotationLayer.css';

pdfjs.GlobalWorkerOptions.workerSrc = `//cdnjs.cloudflare.com/ajax/libs/pdf.js/${pdfjs.version}/pdf.worker.min.js`;


interface DocumentViewerProps {
  documentId: string;
  onClose: () => void;
}

const DocumentViewer: React.FC<DocumentViewerProps> = ({ documentId, onClose }) => {
  const { documents } = useDocumentStore();
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showOCRText, setShowOCRText] = useState(false);
  const [ocrData, setOcrData] = useState<any>(null);
  const [isLoadingOCR, setIsLoadingOCR] = useState(false);

  const [numPages, setNumPages] = useState<number | null>(null);

  const onDocumentLoadSuccess = ({ numPages }: { numPages: number }) => {
    setNumPages(numPages);
  };

  const document = documents.find(d => d.id === documentId);

  useEffect(() => {
    if (showOCRText && !ocrData) {
      loadOCRData();
    }
  }, [showOCRText, documentId]);

  // const loadOCRData = async () => {
  //   setIsLoadingOCR(true);
  //   try {
  //     const response = await fetch(`/api/documents/${documentId}/ocr`, {
  //       headers: {
  //         'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
  //       }
  //     });

  //     if (response.ok) {
  //       const data = await response.json();
  //       setOcrData(data);
  //     } else {
  //       console.error('Failed to load OCR data');
  //     }
  //   } catch (error) {
  //     console.error('Error loading OCR data:', error);
  //   } finally {
  //     setIsLoadingOCR(false);
  //   }
  // };


  const loadOCRData = async () => {
    setIsLoadingOCR(true);
    try {
      const response = await fetch(`/api/documents/${documentId}/ocr`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      const contentType = response.headers.get("content-type");

      if (!response.ok || !contentType?.includes("application/json")) {
        const errorText = await response.text();
        console.error("❌ Unexpected response:", errorText);  // Add this
        throw new Error("Server returned non-JSON (likely HTML or auth error)");
      }

      const data = await response.json();
      console.log("✅ OCR Data:", data);
      setOcrData(data);

    } catch (error) {
      console.error("Error loading OCR data:", error);
    } finally {
      setIsLoadingOCR(false);
    }
  };


  const handleProcessDocument = async () => {
    if (!document) return;

    setIsLoadingOCR(true);
    try {
      await ocrAPI.processDocument(documentId);
      // Reload OCR data after processing
      await loadOCRData();
      // Refresh the page to update document status
      window.location.reload();
    } catch (error) {
      console.error('Error processing document:', error);
    } finally {
      setIsLoadingOCR(false);
    }
  };

  if (!document) {
    return null;
  }

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const getImageUrl = () => {
    if (document.filePath) {
      return `/uploads/${document.filePath}`;
    }
    return '#';
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-6xl w-full h-5/6 flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">{document.fileName}</h3>
            <p className="text-sm text-slate-600">
              {document.fileType} • {Math.round(document.fileSize / 1024)} KB
            </p>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={handleZoomOut}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ZoomOut size={20} />
            </button>
            <span className="text-sm text-slate-600 min-w-[60px] text-center">{zoom}%</span>
            <button
              onClick={handleZoomIn}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <ZoomIn size={20} />
            </button>
            <button
              onClick={handleRotate}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <RotateCw size={20} />
            </button>
            <button
              onClick={() => setShowOCRText(!showOCRText)}
              className={`p-2 rounded-lg transition-colors ${showOCRText
                  ? 'bg-blue-100 text-blue-600'
                  : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                }`}
            >
              <Eye size={20} />
            </button>
            {(document.status === 'uploaded' || document.status === 'error') && (
              <button
                onClick={handleProcessDocument}
                disabled={isLoadingOCR}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50"
              >
                <RefreshCw size={20} className={isLoadingOCR ? 'animate-spin' : ''} />
              </button>
            )}
            <button className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors">
              <Download size={20} />
            </button>
            <button
              onClick={onClose}
              className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="flex-1 flex overflow-hidden">
          {/* Document Preview */}
          <div className="flex-1 bg-slate-100 flex items-center justify-center overflow-auto">
            <div
              className="bg-white shadow-lg"
              style={{
                transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                transformOrigin: 'center'
              }}
            >
              {document.fileType.startsWith('image/') ? (
                <img
                  src={getImageUrl()}
                  alt={document.fileName}
                  className="max-w-full max-h-full"
                  onError={(e) => {
                    console.error('Image failed to load:', getImageUrl());
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : (
                // <div className="w-96 h-96 bg-slate-200 flex items-center justify-center">
                //   <div className="text-center">
                //     <p className="text-slate-600 mb-2">PDF Preview</p>
                //     <p className="text-sm text-slate-500">{document.fileName}</p>
                //   </div>
                // </div>

                <div className="overflow-auto p-4">
                  <PDFDocument
                    file={getImageUrl()}
                    onLoadSuccess={onDocumentLoadSuccess}
                    loading={<p className="text-slate-600">Loading PDF...</p>}
                    error={<p className="text-red-600">Failed to load PDF.</p>}
                  >
                    {Array.from(new Array(numPages || 1), (_, index) => (
                      <Page
                        key={`page_${index + 1}`}
                        pageNumber={index + 1}
                        scale={zoom / 100}
                        rotate={rotation}
                        className="mb-4 border rounded shadow"
                      />
                    ))}
                  </PDFDocument>
                </div>

              )}
            </div>
          </div>

          {/* OCR Text Panel */}
          {showOCRText && (
            <div className="w-1/3 bg-white border-l border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200">
                <h4 className="font-medium text-slate-900">Extracted Text</h4>
                <p className="text-sm text-slate-600">OCR Results</p>
              </div>
              <div className="flex-1 p-4 overflow-auto">
                {isLoadingOCR ? (
                  <div className="flex items-center justify-center h-32">
                    <RefreshCw className="animate-spin text-blue-600" size={24} />
                    <span className="ml-2 text-slate-600">Loading OCR data...</span>
                  </div>
                ) : ocrData ? (
                  <div className="space-y-4">
                    <div>
                      <h5 className="font-medium text-slate-900 mb-2">Document Type</h5>
                      <p className="text-sm text-slate-700">{ocrData.documentType}</p>
                    </div>
                    <div>
                      <h5 className="font-medium text-slate-900 mb-2">Extracted Text</h5>
                      <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded max-h-64 overflow-auto">
                        {ocrData.extractedText}
                      </div>
                    </div>
                    {ocrData.extractedFields && ocrData.extractedFields.length > 0 && (
                      <div>
                        <h5 className="font-medium text-slate-900 mb-2">Extracted Fields ({ocrData.extractedFields.length})</h5>
                        <div className="space-y-2 max-h-64 overflow-auto">
                          {ocrData.extractedFields.map((field: any, index: number) => (
                            <div key={index} className="bg-slate-50 p-2 rounded">
                              <p className="text-sm font-medium text-slate-900">{field.fieldName}</p>
                              <p className="text-sm text-slate-700">{field.fieldValue}</p>
                              <p className="text-xs text-slate-500">Confidence: {Math.round(field.confidence * 100)}%</p>
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                ) : document.status === 'processed' ? (
                  <div className="text-center py-8">
                    <p className="text-slate-600 mb-2">OCR data not loaded</p>
                    <button
                      onClick={loadOCRData}
                      className="text-blue-600 hover:text-blue-800 text-sm"
                    >
                      Click to load OCR results
                    </button>
                  </div>
                ) : (
                  <div className="text-center py-8">
                    <p className="text-slate-600 mb-2">No OCR text available</p>
                    <p className="text-sm text-slate-500 mb-4">
                      {document.status === 'error'
                        ? 'Processing failed. Try reprocessing the document.'
                        : 'Process the document first to extract text'
                      }
                    </p>
                    {(document.status === 'uploaded' || document.status === 'error') && (
                      <button
                        onClick={handleProcessDocument}
                        disabled={isLoadingOCR}
                        className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                      >
                        {isLoadingOCR ? 'Processing...' : 'Process Document'}
                      </button>
                    )}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Document Info */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4 text-sm">
            <div>
              <span className="text-slate-600">Status:</span>
              <span className={`ml-2 px-2 py-1 rounded-full text-xs font-medium ${document.status === 'processed' ? 'bg-green-100 text-green-800' :
                  document.status === 'processing' ? 'bg-yellow-100 text-yellow-800' :
                    document.status === 'error' ? 'bg-red-100 text-red-800' :
                      'bg-blue-100 text-blue-800'
                }`}>
                {document.status}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Uploaded:</span>
              <span className="ml-2 text-slate-900">
                {new Date(document.uploadedAt).toLocaleDateString()}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Iterations:</span>
              <span className="ml-2 text-slate-900">
                {document.iterations?.length || 0}
              </span>
            </div>
            <div>
              <span className="text-slate-600">Fields:</span>
              <span className="ml-2 text-slate-900">
                {document.extractedFields?.length || 0}
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DocumentViewer;