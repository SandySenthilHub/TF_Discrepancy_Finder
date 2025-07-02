import React, { useState, useEffect } from 'react';
import { 
  X, 
  ZoomIn, 
  ZoomOut, 
  RotateCw, 
  Download, 
  Eye, 
  FileText,
  ChevronLeft,
  ChevronRight,
  Layers,
  Copy,
  CheckCircle
} from 'lucide-react';
import DownloadManager from './DownloadManager';

interface SplitDocument {
  id: string;
  originalDocumentId: string;
  splitIndex: number;
  documentType: string;
  content: string;
  extractedText: string;
  confidence: number;
  pageRange: {
    start: number;
    end: number;
  };
  extractedFields: any[];
  metadata: {
    lineStart: number;
    lineEnd: number;
    wordCount: number;
    characterCount: number;
  };
  structuredData?: {
    sections: Array<{
      name: string;
      content: string[];
    }>;
  };
}

interface SplitDocumentViewerProps {
  documentId: string;
  splitDocuments: SplitDocument[];
  onClose: () => void;
}

const SplitDocumentViewer: React.FC<SplitDocumentViewerProps> = ({ 
  documentId, 
  splitDocuments, 
  onClose 
}) => {
  const [currentSplitIndex, setCurrentSplitIndex] = useState(0);
  const [zoom, setZoom] = useState(100);
  const [rotation, setRotation] = useState(0);
  const [showExtractedText, setShowExtractedText] = useState(true);
  const [showDownloadManager, setShowDownloadManager] = useState(false);
  const [copiedText, setCopiedText] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<'formatted' | 'raw' | 'structured'>('formatted');

  const currentSplit = splitDocuments[currentSplitIndex];

  const handleZoomIn = () => setZoom(prev => Math.min(prev + 25, 200));
  const handleZoomOut = () => setZoom(prev => Math.max(prev - 25, 50));
  const handleRotate = () => setRotation(prev => (prev + 90) % 360);

  const handlePrevious = () => {
    setCurrentSplitIndex(prev => Math.max(0, prev - 1));
  };

  const handleNext = () => {
    setCurrentSplitIndex(prev => Math.min(splitDocuments.length - 1, prev + 1));
  };

  const handleCopyText = async (text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      setCopiedText(text);
      setTimeout(() => setCopiedText(null), 2000);
    } catch (error) {
      console.error('Failed to copy text:', error);
    }
  };

  const getDocumentTypeColor = (type: string) => {
    switch (type) {
      case 'Letter of Credit': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'Commercial Invoice': return 'bg-green-100 text-green-800 border-green-200';
      case 'Bill of Lading': return 'bg-purple-100 text-purple-800 border-purple-200';
      case 'Packing List': return 'bg-orange-100 text-orange-800 border-orange-200';
      case 'Certificate of Origin': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
      case 'Insurance Certificate': return 'bg-red-100 text-red-800 border-red-200';
      default: return 'bg-slate-100 text-slate-800 border-slate-200';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const formatContentForDisplay = (content: string) => {
    // Enhanced formatting for better readability
    let formatted = content;
    
    // Add proper spacing around headers
    formatted = formatted.replace(/(LETTER OF CREDIT|COMMERCIAL INVOICE|BILL OF LADING|CERTIFICATE|INSURANCE)/gi, 
      '\n\n═══ $1 ═══\n\n');
    
    // Format field labels
    formatted = formatted.replace(/^([A-Z][A-Z\s]+):\s*(.+)$/gm, 
      '▶ $1:\n  $2\n');
    
    // Format currency amounts
    formatted = formatted.replace(/([A-Z]{3})\s*([\d,]+\.?\d*)/g, 
      '$1 $2');
    
    // Add spacing around sections
    formatted = formatted.replace(/\n([A-Z][A-Z\s]{10,})\n/g, 
      '\n\n── $1 ──\n\n');
    
    return formatted;
  };

  const renderStructuredContent = () => {
    if (!currentSplit.structuredData?.sections) {
      return (
        <div className="text-center py-8 text-slate-500">
          <p>No structured data available for this document.</p>
        </div>
      );
    }

    return (
      <div className="space-y-6">
        {currentSplit.structuredData.sections.map((section, index) => (
          <div key={index} className="bg-slate-50 rounded-lg p-4">
            <h4 className="font-semibold text-slate-900 mb-3 flex items-center">
              <span className="w-2 h-2 bg-blue-500 rounded-full mr-2"></span>
              {section.name}
            </h4>
            <div className="text-sm text-slate-700 space-y-1">
              {section.content.map((line, lineIndex) => (
                <div key={lineIndex} className="py-1">
                  {line}
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>
    );
  };

  if (!currentSplit) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-7xl w-full h-5/6 flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-6 border-b border-slate-200">
            <div className="flex items-center space-x-4">
              <div>
                <h3 className="text-xl font-semibold text-slate-900">
                  Split Document Viewer
                </h3>
                <p className="text-sm text-slate-600">
                  {splitDocuments.length} documents found • Viewing {currentSplitIndex + 1} of {splitDocuments.length}
                </p>
              </div>
              
              <div className={`px-3 py-1 rounded-full text-sm font-medium border ${getDocumentTypeColor(currentSplit.documentType)}`}>
                {currentSplit.documentType}
              </div>
              
              <div className={`px-2 py-1 rounded-full text-xs font-medium ${getConfidenceColor(currentSplit.confidence)}`}>
                {Math.round(currentSplit.confidence * 100)}% confidence
              </div>
            </div>

            <div className="flex items-center space-x-2">
              {/* Navigation */}
              <button
                onClick={handlePrevious}
                disabled={currentSplitIndex === 0}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronLeft size={20} />
              </button>
              
              <span className="text-sm text-slate-600 min-w-[80px] text-center">
                {currentSplitIndex + 1} / {splitDocuments.length}
              </span>
              
              <button
                onClick={handleNext}
                disabled={currentSplitIndex === splitDocuments.length - 1}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <ChevronRight size={20} />
              </button>

              <div className="w-px h-6 bg-slate-300 mx-2" />

              {/* View Mode Toggle */}
              <div className="flex bg-slate-100 rounded-lg p-1">
                {[
                  { key: 'formatted', label: 'Formatted' },
                  { key: 'structured', label: 'Structured' },
                  { key: 'raw', label: 'Raw' }
                ].map(mode => (
                  <button
                    key={mode.key}
                    onClick={() => setViewMode(mode.key as any)}
                    className={`px-3 py-1 text-xs rounded transition-colors ${
                      viewMode === mode.key
                        ? 'bg-white text-slate-900 shadow-sm'
                        : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {mode.label}
                  </button>
                ))}
              </div>

              <div className="w-px h-6 bg-slate-300 mx-2" />

              {/* Zoom Controls */}
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
                onClick={() => setShowExtractedText(!showExtractedText)}
                className={`p-2 rounded-lg transition-colors ${showExtractedText
                    ? 'bg-blue-100 text-blue-600'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-100'
                  }`}
              >
                <Eye size={20} />
              </button>
              
              <button
                onClick={() => setShowDownloadManager(true)}
                className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
              >
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
                className="bg-white shadow-lg p-8 max-w-4xl w-full mx-4"
                style={{
                  transform: `scale(${zoom / 100}) rotate(${rotation}deg)`,
                  transformOrigin: 'center'
                }}
              >
                <div className="space-y-6">
                  <div className="border-b border-slate-200 pb-4">
                    <h2 className="text-2xl font-bold text-slate-900 mb-2">
                      {currentSplit.documentType}
                    </h2>
                    <div className="flex items-center space-x-4 text-sm text-slate-600">
                      <span>Pages: {currentSplit.pageRange.start}-{currentSplit.pageRange.end}</span>
                      <span>Words: {currentSplit.metadata.wordCount}</span>
                      <span>Characters: {currentSplit.metadata.characterCount}</span>
                      <span>Confidence: {Math.round(currentSplit.confidence * 100)}%</span>
                    </div>
                  </div>
                  
                  <div className="text-slate-800 leading-relaxed">
                    {viewMode === 'structured' ? (
                      renderStructuredContent()
                    ) : viewMode === 'formatted' ? (
                      <pre className="whitespace-pre-wrap font-sans">
                        {formatContentForDisplay(currentSplit.content)}
                      </pre>
                    ) : (
                      <pre className="whitespace-pre-wrap font-mono text-sm">
                        {currentSplit.content}
                      </pre>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Split Documents Sidebar */}
            <div className="w-80 bg-white border-l border-slate-200 flex flex-col">
              <div className="p-4 border-b border-slate-200">
                <h4 className="font-medium text-slate-900 flex items-center space-x-2">
                  <Layers size={16} />
                  <span>Split Documents</span>
                </h4>
              </div>
              
              <div className="flex-1 overflow-auto p-4 space-y-3">
                {splitDocuments.map((split, index) => (
                  <div
                    key={split.id}
                    onClick={() => setCurrentSplitIndex(index)}
                    className={`p-3 rounded-lg border cursor-pointer transition-all ${
                      index === currentSplitIndex
                        ? 'border-blue-500 bg-blue-50'
                        : 'border-slate-200 hover:border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div className="flex items-start justify-between mb-2">
                      <div className="flex-1">
                        <h5 className="font-medium text-slate-900 text-sm">
                          {split.documentType}
                        </h5>
                        <p className="text-xs text-slate-500">
                          Split {split.splitIndex} • Pages {split.pageRange.start}-{split.pageRange.end}
                        </p>
                      </div>
                      <div className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(split.confidence)}`}>
                        {Math.round(split.confidence * 100)}%
                      </div>
                    </div>
                    
                    <div className="text-xs text-slate-600">
                      {split.metadata.wordCount} words • {split.extractedFields.length} fields
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Extracted Text Panel */}
            {showExtractedText && (
              <div className="w-1/3 bg-white border-l border-slate-200 flex flex-col">
                <div className="p-4 border-b border-slate-200">
                  <div className="flex items-center justify-between">
                    <h4 className="font-medium text-slate-900">Extracted Content</h4>
                    <button
                      onClick={() => handleCopyText(currentSplit.extractedText)}
                      className="p-1 text-slate-600 hover:text-slate-900 transition-colors"
                      title="Copy text"
                    >
                      {copiedText === currentSplit.extractedText ? (
                        <CheckCircle size={16} className="text-green-600" />
                      ) : (
                        <Copy size={16} />
                      )}
                    </button>
                  </div>
                </div>
                
                <div className="flex-1 overflow-auto p-4 space-y-4">
                  {/* Document Info */}
                  <div className="bg-slate-50 rounded-lg p-3">
                    <h5 className="font-medium text-slate-900 mb-2">Document Info</h5>
                    <div className="space-y-1 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-600">Type:</span>
                        <span className="text-slate-900">{currentSplit.documentType}</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Confidence:</span>
                        <span className="text-slate-900">{Math.round(currentSplit.confidence * 100)}%</span>
                      </div>
                      <div className="flex justify-between">
                        <span className="text-slate-600">Fields:</span>
                        <span className="text-slate-900">{currentSplit.extractedFields.length}</span>
                      </div>
                    </div>
                  </div>

                  {/* Extracted Fields */}
                  {currentSplit.extractedFields.length > 0 && (
                    <div>
                      <h5 className="font-medium text-slate-900 mb-2">Extracted Fields</h5>
                      <div className="space-y-2">
                        {currentSplit.extractedFields.map((field, index) => (
                          <div key={index} className="bg-slate-50 rounded p-2">
                            <div className="flex items-center justify-between mb-1">
                              <span className="text-sm font-medium text-slate-900">
                                {field.fieldName}
                              </span>
                              <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(field.confidence)}`}>
                                {Math.round(field.confidence * 100)}%
                              </span>
                            </div>
                            <p className="text-sm text-slate-700">{field.fieldValue}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Raw Text */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <h5 className="font-medium text-slate-900">Raw Text</h5>
                      <button
                        onClick={() => handleCopyText(currentSplit.extractedText)}
                        className="text-xs text-blue-600 hover:text-blue-800"
                      >
                        Copy
                      </button>
                    </div>
                    <div className="text-sm text-slate-700 whitespace-pre-wrap bg-slate-50 p-3 rounded max-h-64 overflow-auto">
                      {currentSplit.extractedText}
                    </div>
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Footer */}
          <div className="p-4 border-t border-slate-200 bg-slate-50">
            <div className="flex items-center justify-between text-sm">
              <div className="flex items-center space-x-4">
                <span className="text-slate-600">
                  Document: {currentSplit.splitIndex} of {splitDocuments.length}
                </span>
                <span className="text-slate-600">
                  Type: {currentSplit.documentType}
                </span>
                <span className="text-slate-600">
                  Confidence: {Math.round(currentSplit.confidence * 100)}%
                </span>
              </div>
              <div className="flex items-center space-x-4">
                <div className="flex items-center space-x-2">
                  <FileText size={16} className="text-slate-400" />
                  <span className="text-slate-600">
                    {currentSplit.metadata.wordCount} words, {currentSplit.extractedFields.length} fields
                  </span>
                </div>
                <button
                  onClick={() => setShowDownloadManager(true)}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Download size={16} />
                  <span>Download</span>
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Download Manager */}
      {showDownloadManager && (
        <DownloadManager
          documentId={documentId}
          onClose={() => setShowDownloadManager(false)}
        />
      )}
    </>
  );
};

export default SplitDocumentViewer;