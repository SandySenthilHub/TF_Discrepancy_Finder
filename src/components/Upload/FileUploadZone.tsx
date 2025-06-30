import React from 'react';
import { useDropzone } from 'react-dropzone';
import { Upload, FileText, Image } from 'lucide-react';

interface FileUploadZoneProps {
  onFilesSelected: (files: File[]) => void;
  disabled?: boolean;
  maxSize?: number;
  acceptedTypes?: string[];
}

const FileUploadZone: React.FC<FileUploadZoneProps> = ({
  onFilesSelected,
  disabled = false,
  maxSize = 10485760, // 10MB
  acceptedTypes = ['image/*', 'application/pdf']
}) => {
  const { getRootProps, getInputProps, isDragActive, fileRejections } = useDropzone({
    accept: acceptedTypes.reduce((acc, type) => {
      if (type === 'image/*') {
        acc['image/*'] = ['.jpeg', '.jpg', '.png'];
      } else if (type === 'application/pdf') {
        acc['application/pdf'] = ['.pdf'];
      }
      return acc;
    }, {} as Record<string, string[]>),
    maxSize,
    disabled,
    onDrop: onFilesSelected,
    onDropRejected: (rejectedFiles) => {
      rejectedFiles.forEach(rejection => {
        const error = rejection.errors[0]?.message || 'File rejected';
        console.error('File rejected:', rejection.file.name, error);
      });
    }
  });

  return (
    <div className="space-y-4">
      <div
        {...getRootProps()}
        className={`border-2 border-dashed rounded-xl p-12 text-center transition-all cursor-pointer ${
          isDragActive
            ? 'border-blue-500 bg-blue-50'
            : !disabled
            ? 'border-slate-300 hover:border-blue-400 hover:bg-slate-50'
            : 'border-slate-200 bg-slate-50 cursor-not-allowed'
        }`}
      >
        <input {...getInputProps()} />
        
        <div className="space-y-4">
          <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
            isDragActive ? 'bg-blue-100' : 'bg-slate-100'
          }`}>
            <Upload className={isDragActive ? 'text-blue-600' : 'text-slate-400'} size={32} />
          </div>
          
          {!disabled ? (
            <>
              <div>
                <h3 className="text-xl font-semibold text-slate-900 mb-2">
                  {isDragActive ? 'Drop files here' : 'Drag & drop files here'}
                </h3>
                <p className="text-slate-600">
                  or <span className="text-blue-600 font-medium">browse files</span> to upload
                </p>
              </div>
              <div className="text-sm text-slate-500">
                <p>Supported formats: PDF, JPEG, JPG, PNG</p>
                <p>Maximum file size: {Math.round(maxSize / 1024 / 1024)}MB</p>
              </div>
            </>
          ) : (
            <div>
              <h3 className="text-xl font-semibold text-slate-400 mb-2">Select a session first</h3>
              <p className="text-slate-500">Choose an existing session or create a new one to upload files</p>
            </div>
          )}
        </div>
      </div>

      {fileRejections.length > 0 && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <h4 className="text-sm font-medium text-red-800 mb-2">Some files were rejected:</h4>
          <ul className="text-sm text-red-700 space-y-1">
            {fileRejections.map((rejection, index) => (
              <li key={index}>
                <strong>{rejection.file.name}</strong>: {rejection.errors[0]?.message}
              </li>
            ))}
          </ul>
        </div>
      )}
    </div>
  );
};

export default FileUploadZone;