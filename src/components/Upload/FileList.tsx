import React from 'react';
import { FileText, Image, X, Check, AlertCircle, Clock } from 'lucide-react';

interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

interface FileListProps {
  files: UploadedFile[];
  onRemoveFile: (fileId: string) => void;
}

const FileList: React.FC<FileListProps> = ({ files, onRemoveFile }) => {
  const getFileIcon = (file: File) => {
    if (file.type.startsWith('image/')) {
      return <Image className="text-blue-500" size={24} />;
    }
    return <FileText className="text-red-500" size={24} />;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
  };

  if (files.length === 0) return null;

  return (
    <div className="mt-8">
      <h3 className="text-lg font-semibold text-slate-900 mb-4">
        Files to Upload ({files.length})
      </h3>
      <div className="space-y-3">
        {files.map((uploadFile) => (
          <div
            key={uploadFile.id}
            className="flex items-center space-x-4 p-4 bg-slate-50 rounded-lg"
          >
            <div className="flex-shrink-0">
              {getFileIcon(uploadFile.file)}
            </div>
            
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-slate-900 truncate">
                {uploadFile.file.name}
              </p>
              <p className="text-sm text-slate-500">
                {formatFileSize(uploadFile.file.size)}
              </p>
              
              {uploadFile.status === 'uploading' && (
                <div className="mt-2">
                  <div className="bg-slate-200 rounded-full h-2">
                    <div
                      className="bg-blue-600 h-2 rounded-full transition-all duration-300"
                      style={{ width: `${uploadFile.progress}%` }}
                    />
                  </div>
                </div>
              )}

              {uploadFile.error && (
                <p className="text-sm text-red-600 mt-1">{uploadFile.error}</p>
              )}
            </div>
            
            <div className="flex-shrink-0 flex items-center space-x-2">
              {uploadFile.status === 'pending' && (
                <Clock className="text-slate-400" size={20} />
              )}
              {uploadFile.status === 'uploading' && (
                <div className="animate-spin rounded-full h-5 w-5 border-2 border-blue-600 border-t-transparent" />
              )}
              {uploadFile.status === 'success' && (
                <Check className="text-green-500" size={20} />
              )}
              {uploadFile.status === 'error' && (
                <AlertCircle className="text-red-500" size={20} />
              )}
              
              {uploadFile.status === 'pending' && (
                <button
                  onClick={() => onRemoveFile(uploadFile.id)}
                  className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                >
                  <X size={16} />
                </button>
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default FileList;