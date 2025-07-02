import React, { useState, useEffect } from 'react';
import { 
  Download, 
  FileText, 
  File, 
  Package, 
  CheckCircle, 
  AlertCircle,
  Loader,
  Eye,
  X
} from 'lucide-react';

interface DownloadOption {
  splitIndex: number;
  documentType: string;
  confidence: number;
  fieldCount: number;
  wordCount: number;
  downloadLinks: {
    pdf: string;
    txt: string;
    json: string;
    markdown: string;
  };
}

interface DownloadManagerProps {
  documentId: string;
  onClose: () => void;
}

const DownloadManager: React.FC<DownloadManagerProps> = ({ documentId, onClose }) => {
  const [downloadOptions, setDownloadOptions] = useState<any>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [downloadingFiles, setDownloadingFiles] = useState<Set<string>>(new Set());
  const [downloadedFiles, setDownloadedFiles] = useState<Set<string>>(new Set());
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    loadDownloadOptions();
  }, [documentId]);

  const loadDownloadOptions = async () => {
    try {
      setIsLoading(true);
      const response = await fetch(`/api/downloads/options/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Failed to load download options');
      }

      const options = await response.json();
      setDownloadOptions(options);
    } catch (error: any) {
      setError(error.message);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDownload = async (url: string, fileName: string) => {
    try {
      setDownloadingFiles(prev => new Set(prev).add(fileName));
      
      const response = await fetch(url, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Download failed');
      }

      // Create blob and download
      const blob = await response.blob();
      const downloadUrl = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = downloadUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      window.URL.revokeObjectURL(downloadUrl);

      setDownloadedFiles(prev => new Set(prev).add(fileName));
    } catch (error: any) {
      console.error('Download error:', error);
      alert(`Download failed: ${error.message}`);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete(fileName);
        return newSet;
      });
    }
  };

  const handlePackageDownload = async () => {
    try {
      setDownloadingFiles(prev => new Set(prev).add('package'));
      
      const response = await fetch(`/api/downloads/package/${documentId}`, {
        headers: {
          'Authorization': `Bearer ${localStorage.getItem('auth_token')}`
        }
      });

      if (!response.ok) {
        throw new Error('Package generation failed');
      }

      const packageInfo = await response.json();
      
      // Download manifest first
      await handleDownload(`/api${packageInfo.downloadLinks.manifest}`, 'package_manifest.json');
      
      // Download all document files
      for (const doc of packageInfo.downloadLinks.documents) {
        await handleDownload(`/api${doc.textFile}`, `${doc.documentType}_${doc.splitIndex}.txt`);
        await handleDownload(`/api${doc.jsonFile}`, `${doc.documentType}_${doc.splitIndex}.json`);
      }
      
      setDownloadedFiles(prev => new Set(prev).add('package'));
    } catch (error: any) {
      console.error('Package download error:', error);
      alert(`Package download failed: ${error.message}`);
    } finally {
      setDownloadingFiles(prev => {
        const newSet = new Set(prev);
        newSet.delete('package');
        return newSet;
      });
    }
  };

  const getFormatIcon = (format: string) => {
    switch (format) {
      case 'pdf': return <File className="text-red-600" size={16} />;
      case 'txt': return <FileText className="text-blue-600" size={16} />;
      case 'json': return <File className="text-green-600" size={16} />;
      case 'markdown': return <FileText className="text-purple-600" size={16} />;
      default: return <File className="text-slate-600" size={16} />;
    }
  };

  const getFormatDescription = (format: string) => {
    switch (format) {
      case 'pdf': return 'Formatted PDF document';
      case 'txt': return 'Plain text with enhanced formatting';
      case 'json': return 'Structured JSON with metadata';
      case 'markdown': return 'Markdown format for documentation';
      default: return 'Unknown format';
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  if (isLoading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
          <div className="flex items-center justify-center py-12">
            <Loader className="animate-spin text-blue-600" size={32} />
            <span className="ml-3 text-slate-600">Loading download options...</span>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full p-6">
          <div className="flex items-center justify-between mb-4">
            <h3 className="text-xl font-semibold text-slate-900">Download Error</h3>
            <button onClick={onClose} className="p-2 hover:bg-slate-100 rounded-lg">
              <X size={20} />
            </button>
          </div>
          <div className="flex items-center space-x-3 text-red-600">
            <AlertCircle size={24} />
            <span>{error}</span>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-2xl shadow-xl max-w-4xl w-full max-h-5/6 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-slate-200">
          <div>
            <h3 className="text-xl font-semibold text-slate-900">Download Options</h3>
            <p className="text-sm text-slate-600">
              {downloadOptions?.fileName} • {downloadOptions?.splitCount} documents
            </p>
          </div>
          <button
            onClick={onClose}
            className="p-2 text-slate-600 hover:text-slate-900 hover:bg-slate-100 rounded-lg transition-colors"
          >
            <X size={20} />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-6">
          {/* Package Download */}
          {downloadOptions?.packageDownload && (
            <div className="mb-8 p-6 bg-gradient-to-r from-blue-50 to-indigo-50 rounded-xl border border-blue-200">
              <div className="flex items-center justify-between">
                <div className="flex items-center space-x-3">
                  <div className="p-3 bg-blue-600 rounded-lg">
                    <Package className="text-white" size={24} />
                  </div>
                  <div>
                    <h4 className="font-semibold text-blue-900">Complete Package</h4>
                    <p className="text-sm text-blue-700">
                      Download all {downloadOptions.splitCount} documents in multiple formats
                    </p>
                    <p className="text-xs text-blue-600 mt-1">
                      Includes: Text files, JSON data, and manifest
                    </p>
                  </div>
                </div>
                <button
                  onClick={handlePackageDownload}
                  disabled={downloadingFiles.has('package')}
                  className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                >
                  {downloadingFiles.has('package') ? (
                    <Loader className="animate-spin" size={16} />
                  ) : downloadedFiles.has('package') ? (
                    <CheckCircle size={16} />
                  ) : (
                    <Download size={16} />
                  )}
                  <span>
                    {downloadingFiles.has('package') ? 'Downloading...' : 
                     downloadedFiles.has('package') ? 'Downloaded' : 'Download Package'}
                  </span>
                </button>
              </div>
            </div>
          )}

          {/* Individual Documents */}
          <div className="space-y-6">
            <h4 className="text-lg font-semibold text-slate-900">Individual Documents</h4>
            
            {downloadOptions?.splitDocuments?.map((doc: DownloadOption, index: number) => (
              <div key={index} className="bg-slate-50 rounded-xl p-6 border border-slate-200">
                <div className="flex items-center justify-between mb-4">
                  <div>
                    <h5 className="font-semibold text-slate-900">{doc.documentType}</h5>
                    <div className="flex items-center space-x-4 mt-1">
                      <span className={`text-xs px-2 py-1 rounded-full ${getConfidenceColor(doc.confidence)}`}>
                        {Math.round(doc.confidence * 100)}% confidence
                      </span>
                      <span className="text-xs text-slate-600">
                        {doc.fieldCount} fields • {doc.wordCount} words
                      </span>
                    </div>
                  </div>
                  <span className="text-sm text-slate-600">Split {doc.splitIndex}</span>
                </div>

                {/* Download Formats */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                  {Object.entries(doc.downloadLinks).map(([format, url]) => {
                    const fileName = `${doc.documentType.replace(/\s+/g, '_')}_${doc.splitIndex}.${format}`;
                    const isDownloading = downloadingFiles.has(fileName);
                    const isDownloaded = downloadedFiles.has(fileName);
                    
                    return (
                      <button
                        key={format}
                        onClick={() => handleDownload(url, fileName)}
                        disabled={isDownloading}
                        className="p-3 bg-white rounded-lg border border-slate-200 hover:border-slate-300 hover:shadow-sm transition-all disabled:opacity-50 text-left"
                      >
                        <div className="flex items-center space-x-2 mb-2">
                          {getFormatIcon(format)}
                          <span className="font-medium text-slate-900 uppercase text-xs">
                            {format}
                          </span>
                          {isDownloading && <Loader className="animate-spin" size={12} />}
                          {isDownloaded && <CheckCircle className="text-green-600" size={12} />}
                        </div>
                        <p className="text-xs text-slate-600">
                          {getFormatDescription(format)}
                        </p>
                      </button>
                    );
                  })}
                </div>
              </div>
            ))}
          </div>

          {/* Format Descriptions */}
          <div className="mt-8 p-4 bg-slate-50 rounded-lg">
            <h5 className="font-medium text-slate-900 mb-3">Format Descriptions</h5>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm">
              {Object.entries(downloadOptions?.availableFormats || {}).map(([format, description]) => (
                <div key={format} className="flex items-center space-x-2">
                  {getFormatIcon(format)}
                  <span className="font-medium text-slate-700 uppercase">{format}:</span>
                  <span className="text-slate-600">{description}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-6 border-t border-slate-200 bg-slate-50">
          <div className="flex items-center justify-between text-sm">
            <div className="text-slate-600">
              {downloadOptions?.hasSplitDocuments ? 
                `${downloadOptions.splitCount} split documents available` : 
                'Single document available'
              }
            </div>
            <div className="flex items-center space-x-2 text-slate-600">
              <Download size={16} />
              <span>All downloads are temporary and will be cleaned up automatically</span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DownloadManager;