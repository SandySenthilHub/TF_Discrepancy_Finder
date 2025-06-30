import React, { useState, useEffect } from 'react';
import { useDropzone } from 'react-dropzone';
import { 
  Upload as UploadIcon, 
  FileText, 
  Image, 
  X, 
  Check, 
  AlertCircle,
  Plus,
  FolderOpen,
  Clock,
  CheckCircle2
} from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { useAuthStore } from '../store/authStore';

interface UploadedFile {
  file: File;
  id: string;
  status: 'pending' | 'uploading' | 'success' | 'error';
  progress: number;
  error?: string;
}

const Upload: React.FC = () => {
  const { sessions, loadSessions, createSession, uploadDocument, isLoading } = useSessionStore();
  const { user } = useAuthStore();
  const [selectedSessionId, setSelectedSessionId] = useState<string>('');
  const [uploadedFiles, setUploadedFiles] = useState<UploadedFile[]>([]);
  const [showCreateSession, setShowCreateSession] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [newSession, setNewSession] = useState({
    cifNumber: '',
    lcNumber: '',
    lifecycle: ''
  });

  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    accept: {
      'image/*': ['.jpeg', '.jpg', '.png'],
      'application/pdf': ['.pdf']
    },
    maxSize: 10485760, // 10MB
    disabled: !selectedSessionId || isUploading,
    onDrop: (acceptedFiles) => {
      const newFiles: UploadedFile[] = acceptedFiles.map(file => ({
        file,
        id: Math.random().toString(36).substr(2, 9),
        status: 'pending',
        progress: 0
      }));
      setUploadedFiles(prev => [...prev, ...newFiles]);
    },
    onDropRejected: (rejectedFiles) => {
      rejectedFiles.forEach(rejection => {
        const error = rejection.errors[0]?.message || 'File rejected';
        console.error('File rejected:', rejection.file.name, error);
        // You could show a toast notification here
      });
    }
  });

  const removeFile = (fileId: string) => {
    setUploadedFiles(prev => prev.filter(f => f.id !== fileId));
  };

  const handleCreateSession = async () => {
    if (!newSession.cifNumber || !newSession.lcNumber || !newSession.lifecycle) {
      return;
    }

    try {
      const session = await createSession(newSession);
      setSelectedSessionId(session.id);
      setShowCreateSession(false);
      setNewSession({ cifNumber: '', lcNumber: '', lifecycle: '' });
    } catch (error) {
      console.error('Error creating session:', error);
      // You could show an error toast here
    }
  };

  const uploadFiles = async () => {
    if (!selectedSessionId || uploadedFiles.length === 0) return;

    setIsUploading(true);
    const pendingFiles = uploadedFiles.filter(f => f.status === 'pending');

    for (const uploadFile of pendingFiles) {
      try {
        // Update status to uploading
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'uploading', progress: 0 }
              : f
          )
        );

        // Simulate progress updates
        const progressInterval = setInterval(() => {
          setUploadedFiles(prev => 
            prev.map(f => 
              f.id === uploadFile.id && f.progress < 90
                ? { ...f, progress: f.progress + 10 }
                : f
            )
          );
        }, 200);

        // Upload the file
        await uploadDocument(selectedSessionId, uploadFile.file);

        // Clear progress interval and mark as success
        clearInterval(progressInterval);
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { ...f, status: 'success', progress: 100 }
              : f
          )
        );

      } catch (error: any) {
        setUploadedFiles(prev => 
          prev.map(f => 
            f.id === uploadFile.id 
              ? { 
                  ...f, 
                  status: 'error', 
                  progress: 0, 
                  error: error.message || 'Upload failed' 
                }
              : f
          )
        );
      }
    }

    setIsUploading(false);
  };

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

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'created': return 'bg-gray-100 text-gray-800';
      case 'uploading': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'reviewing': return 'bg-purple-100 text-purple-800';
      case 'completed': return 'bg-green-100 text-green-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const activeSessions = sessions.filter(s => s.status !== 'completed' && s.status !== 'frozen');
  const canUpload = selectedSessionId && uploadedFiles.some(f => f.status === 'pending') && !isUploading;

  if (isLoading) {
    return (
      <div className="p-6 max-w-6xl mx-auto">
        <div className="animate-pulse space-y-8">
          <div className="text-center">
            <div className="h-10 bg-slate-200 rounded w-1/3 mx-auto mb-4"></div>
            <div className="h-6 bg-slate-200 rounded w-2/3 mx-auto"></div>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
            <div className="h-8 bg-slate-200 rounded w-1/4 mb-6"></div>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {[...Array(3)].map((_, i) => (
                <div key={i} className="h-32 bg-slate-200 rounded-xl"></div>
              ))}
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-8">
      {/* Header */}
      <div className="text-center">
        <h1 className="text-4xl font-bold text-slate-900 mb-4">Upload Documents</h1>
        <p className="text-lg text-slate-600 max-w-2xl mx-auto">
          Upload trade finance documents for processing. Select an existing session or create a new one to get started.
        </p>
      </div>

      {/* Session Selection */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <div className="flex items-center justify-between mb-6">
          <h2 className="text-2xl font-semibold text-slate-900">Select Session</h2>
          <button
            onClick={() => setShowCreateSession(true)}
            disabled={isUploading}
            className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Plus size={20} />
            <span>New Session</span>
          </button>
        </div>

        {activeSessions.length > 0 ? (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {activeSessions.map((session) => (
              <div
                key={session.id}
                onClick={() => !isUploading && setSelectedSessionId(session.id)}
                className={`p-4 rounded-xl border-2 transition-all hover:shadow-md ${
                  isUploading 
                    ? 'cursor-not-allowed opacity-50' 
                    : 'cursor-pointer'
                } ${
                  selectedSessionId === session.id
                    ? 'border-blue-500 bg-blue-50'
                    : 'border-slate-200 hover:border-slate-300'
                }`}
              >
                <div className="flex items-start justify-between mb-3">
                  <div className="flex-1">
                    <h3 className="font-semibold text-slate-900">{session.lcNumber}</h3>
                    <p className="text-sm text-slate-600">CIF: {session.cifNumber}</p>
                    <p className="text-xs text-slate-500 mt-1">{session.lifecycle}</p>
                  </div>
                  {selectedSessionId === session.id && (
                    <CheckCircle2 className="text-blue-500" size={20} />
                  )}
                </div>
                <div className="flex items-center justify-between">
                  <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(session.status)}`}>
                    {session.status}
                  </span>
                  <span className="text-xs text-slate-500">
                    {session.documents?.length || 0} docs
                  </span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12">
            <FolderOpen className="mx-auto text-slate-400 mb-4" size={48} />
            <h3 className="text-lg font-medium text-slate-900 mb-2">No Active Sessions</h3>
            <p className="text-slate-600 mb-4">Create a new session to start uploading documents</p>
            <button
              onClick={() => setShowCreateSession(true)}
              disabled={isUploading}
              className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Create First Session
            </button>
          </div>
        )}
      </div>

      {/* File Upload Area */}
      <div className="bg-white rounded-2xl shadow-sm border border-slate-200 p-8">
        <h2 className="text-2xl font-semibold text-slate-900 mb-6">Upload Files</h2>
        
        <div
          {...getRootProps()}
          className={`border-2 border-dashed rounded-xl p-12 text-center transition-all ${
            isDragActive
              ? 'border-blue-500 bg-blue-50'
              : selectedSessionId && !isUploading
              ? 'border-slate-300 hover:border-blue-400 hover:bg-slate-50 cursor-pointer'
              : 'border-slate-200 bg-slate-50 cursor-not-allowed'
          }`}
        >
          <input {...getInputProps()} />
          
          <div className="space-y-4">
            <div className={`mx-auto w-16 h-16 rounded-full flex items-center justify-center ${
              isDragActive ? 'bg-blue-100' : 'bg-slate-100'
            }`}>
              <UploadIcon className={isDragActive ? 'text-blue-600' : 'text-slate-400'} size={32} />
            </div>
            
            {selectedSessionId && !isUploading ? (
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
                  <p>Maximum file size: 10MB</p>
                </div>
              </>
            ) : (
              <div>
                <h3 className="text-xl font-semibold text-slate-400 mb-2">
                  {isUploading ? 'Upload in progress...' : 'Select a session first'}
                </h3>
                <p className="text-slate-500">
                  {isUploading 
                    ? 'Please wait while files are being uploaded' 
                    : 'Choose an existing session or create a new one to upload files'
                  }
                </p>
              </div>
            )}
          </div>
        </div>

        {/* Uploaded Files List */}
        {uploadedFiles.length > 0 && (
          <div className="mt-8">
            <h3 className="text-lg font-semibold text-slate-900 mb-4">
              Files to Upload ({uploadedFiles.length})
            </h3>
            <div className="space-y-3">
              {uploadedFiles.map((uploadFile) => (
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
                    
                    {uploadFile.status === 'pending' && !isUploading && (
                      <button
                        onClick={() => removeFile(uploadFile.id)}
                        className="p-1 text-slate-400 hover:text-red-500 transition-colors"
                      >
                        <X size={16} />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            
            {canUpload && (
              <div className="mt-6 flex justify-end">
                <button
                  onClick={uploadFiles}
                  className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                >
                  <UploadIcon size={20} />
                  <span>Upload All Files</span>
                </button>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Create Session Modal */}
      {showCreateSession && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-6">
              <h3 className="text-xl font-semibold text-slate-900">Create New Session</h3>
              <button
                onClick={() => setShowCreateSession(false)}
                className="p-2 text-slate-400 hover:text-slate-600 transition-colors"
              >
                <X size={20} />
              </button>
            </div>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  CIF Number *
                </label>
                <input
                  type="text"
                  value={newSession.cifNumber}
                  onChange={(e) => setNewSession(prev => ({ ...prev, cifNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter CIF number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  LC Number *
                </label>
                <input
                  type="text"
                  value={newSession.lcNumber}
                  onChange={(e) => setNewSession(prev => ({ ...prev, lcNumber: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  placeholder="Enter LC number"
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Lifecycle *
                </label>
                <select
                  value={newSession.lifecycle}
                  onChange={(e) => setNewSession(prev => ({ ...prev, lifecycle: e.target.value }))}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">Select lifecycle</option>
                  <option value="Import LC">Import LC</option>
                  <option value="Export LC">Export LC</option>
                  <option value="Standby LC">Standby LC</option>
                  <option value="Documentary Collection">Documentary Collection</option>
                  <option value="Trade Finance">Trade Finance</option>
                  <option value="Bank Guarantee">Bank Guarantee</option>
                  <option value="Supply Chain Finance">Supply Chain Finance</option>
                </select>
              </div>
            </div>
            
            <div className="flex space-x-3 mt-6">
              <button
                onClick={() => setShowCreateSession(false)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleCreateSession}
                disabled={!newSession.cifNumber || !newSession.lcNumber || !newSession.lifecycle}
                className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                Create Session
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Upload;