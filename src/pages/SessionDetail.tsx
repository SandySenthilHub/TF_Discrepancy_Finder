import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { 
  ArrowLeft, 
  FileText, 
  Eye, 
  Edit, 
  Trash2, 
  RefreshCw, 
  Check, 
  X, 
  AlertTriangle,
  Save,
  Lock,
  Unlock,
  Upload,
  Download,
  Settings
} from 'lucide-react';
import { useSessionStore } from '../store/sessionStore';
import { useDocumentStore } from '../store/documentStore';
import DocumentViewer from '../components/Documents/DocumentViewer';
import FieldExtractor from '../components/Documents/FieldExtractor';
import DocumentComparator from '../components/Documents/DocumentComparator';

const SessionDetail: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const { currentSession, setCurrentSession, updateSessionStatus } = useSessionStore();
  const { 
    documents, 
    loadDocuments, 
    processDocument, 
    validateDocument,
    extractFields,
    compareDocument,
    deleteDocument,
    isLoading 
  } = useDocumentStore();
  
  const [activeTab, setActiveTab] = useState<'documents' | 'fields' | 'review' | 'final'>('documents');
  const [selectedDocument, setSelectedDocument] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);
  const [sessionFrozen, setSessionFrozen] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState<string | null>(null);

  useEffect(() => {
    if (sessionId) {
      loadDocuments(sessionId);
    }
  }, [sessionId, loadDocuments]);

  const handleProcessDocument = async (documentId: string) => {
    setIsProcessing(true);
    try {
      await processDocument(documentId);
      await updateSessionStatus(sessionId!, 'processing');
    } catch (error) {
      console.error('Error processing document:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidateDocument = async (documentId: string, isValid: boolean) => {
    try {
      await validateDocument(documentId, isValid);
      if (!isValid) {
        // Increment iteration for reprocessing
        await handleProcessDocument(documentId);
      }
    } catch (error) {
      console.error('Error validating document:', error);
    }
  };

  const handleDeleteDocument = async (documentId: string) => {
    try {
      await deleteDocument(documentId);
      setShowDeleteConfirm(null);
      // Reload documents to update the list
      await loadDocuments(sessionId!);
    } catch (error) {
      console.error('Error deleting document:', error);
    }
  };

  const handleFreezeSession = async () => {
    try {
      await updateSessionStatus(sessionId!, 'frozen');
      setSessionFrozen(true);
    } catch (error) {
      console.error('Error freezing session:', error);
    }
  };

  const handleSaveSession = async () => {
    try {
      await updateSessionStatus(sessionId!, 'completed');
      // Trigger final storage process
      navigate('/sessions');
    } catch (error) {
      console.error('Error saving session:', error);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'uploaded': return 'bg-blue-100 text-blue-800';
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'processed': return 'bg-green-100 text-green-800';
      case 'validated': return 'bg-emerald-100 text-emerald-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  if (isLoading) {
    return (
      <div className="p-6">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-slate-200 rounded w-1/4"></div>
          <div className="h-64 bg-slate-200 rounded"></div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center space-x-4">
          <button
            onClick={() => navigate('/sessions')}
            className="p-2 text-slate-600 hover:text-slate-900 transition-colors"
          >
            <ArrowLeft size={20} />
          </button>
          <div>
            <h1 className="text-3xl font-bold text-slate-900">
              Session: {currentSession?.lcNumber}
            </h1>
            <p className="text-slate-600">
              CIF: {currentSession?.cifNumber} | Lifecycle: {currentSession?.lifecycle}
            </p>
          </div>
        </div>
        
        <div className="flex items-center space-x-3">
          {!sessionFrozen && currentSession?.status !== 'completed' && (
            <>
              <button
                onClick={handleFreezeSession}
                className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
              >
                <Lock size={20} />
                <span>Freeze Session</span>
              </button>
              <button
                onClick={handleSaveSession}
                className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
              >
                <Save size={20} />
                <span>Save & Complete</span>
              </button>
            </>
          )}
          {sessionFrozen && (
            <div className="flex items-center space-x-2 text-yellow-600">
              <Lock size={20} />
              <span className="font-medium">Session Frozen</span>
            </div>
          )}
        </div>
      </div>

      {/* Progress Steps */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="flex items-center justify-between">
          {[
            { step: 1, label: 'Upload', status: documents.length > 0 ? 'completed' : 'pending' },
            { step: 2, label: 'OCR & Process', status: documents.some(d => d.status === 'processed') ? 'completed' : 'pending' },
            { step: 3, label: 'Validate', status: documents.some(d => d.status === 'validated') ? 'completed' : 'pending' },
            { step: 4, label: 'Extract Fields', status: 'pending' },
            { step: 5, label: 'Compare & Catalog', status: 'pending' },
            { step: 6, label: 'Review', status: 'pending' },
            { step: 7, label: 'Final Storage', status: currentSession?.status === 'completed' ? 'completed' : 'pending' }
          ].map((item, index) => (
            <div key={item.step} className="flex items-center">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center text-sm font-medium ${
                item.status === 'completed' 
                  ? 'bg-green-500 text-white' 
                  : 'bg-slate-200 text-slate-600'
              }`}>
                {item.status === 'completed' ? <Check size={16} /> : item.step}
              </div>
              <span className="ml-2 text-sm font-medium text-slate-700">{item.label}</span>
              {index < 6 && (
                <div className={`w-12 h-0.5 mx-4 ${
                  item.status === 'completed' ? 'bg-green-500' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'documents', label: 'Documents', icon: FileText },
              { id: 'fields', label: 'Field Extraction', icon: Settings },
              { id: 'review', label: 'Review & Edit', icon: Eye },
              { id: 'final', label: 'Final Review', icon: Check }
            ].map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as any)}
                className={`flex items-center space-x-2 py-4 border-b-2 transition-colors ${
                  activeTab === tab.id
                    ? 'border-blue-500 text-blue-600'
                    : 'border-transparent text-slate-600 hover:text-slate-900'
                }`}
              >
                <tab.icon size={20} />
                <span className="font-medium">{tab.label}</span>
              </button>
            ))}
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === 'documents' && (
            <div className="space-y-6">
              <div className="flex items-center justify-between">
                <h2 className="text-xl font-semibold text-slate-900">
                  Documents ({documents.length})
                </h2>
                <button
                  onClick={() => navigate('/upload')}
                  className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
                >
                  <Upload size={20} />
                  <span>Upload More</span>
                </button>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {documents.map((document) => (
                  <div key={document.id} className="bg-slate-50 rounded-lg p-4">
                    <div className="flex items-start justify-between mb-3">
                      <div className="flex-1">
                        <h3 className="font-medium text-slate-900">{document.fileName}</h3>
                        <p className="text-sm text-slate-600">
                          {document.fileType} • {Math.round(document.fileSize / 1024)} KB
                        </p>
                        <p className="text-xs text-slate-500 mt-1">
                          Uploaded: {new Date(document.uploadedAt).toLocaleString()}
                        </p>
                      </div>
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(document.status)}`}>
                        {document.status}
                      </span>
                    </div>

                    <div className="flex items-center space-x-2">
                      <button
                        onClick={() => setSelectedDocument(document.id)}
                        className="flex-1 bg-blue-600 text-white px-3 py-2 rounded text-sm hover:bg-blue-700 transition-colors flex items-center justify-center space-x-1"
                      >
                        <Eye size={16} />
                        <span>View</span>
                      </button>
                      
                      {document.status === 'uploaded' && (
                        <button
                          onClick={() => handleProcessDocument(document.id)}
                          disabled={isProcessing}
                          className="flex-1 bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors flex items-center justify-center space-x-1 disabled:opacity-50"
                        >
                          <RefreshCw size={16} className={isProcessing ? 'animate-spin' : ''} />
                          <span>Process</span>
                        </button>
                      )}
                      
                      {document.status === 'processed' && (
                        <div className="flex space-x-1">
                          <button
                            onClick={() => handleValidateDocument(document.id, true)}
                            className="bg-green-600 text-white px-3 py-2 rounded text-sm hover:bg-green-700 transition-colors"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleValidateDocument(document.id, false)}
                            className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      )}

                      {/* Delete button - only show if session is not frozen/completed */}
                      {currentSession?.status !== 'frozen' && currentSession?.status !== 'completed' && (
                        <button
                          onClick={() => setShowDeleteConfirm(document.id)}
                          className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                          title="Delete Document"
                        >
                          <Trash2 size={16} />
                        </button>
                      )}
                    </div>

                    {document.iterations && document.iterations.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-500">
                          Iterations: {document.iterations.length}
                        </p>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {activeTab === 'fields' && (
            <FieldExtractor 
              documents={documents.filter(d => d.status === 'validated')}
              sessionId={sessionId!}
            />
          )}

          {activeTab === 'review' && (
            <DocumentComparator 
              documents={documents.filter(d => d.extractedFields.length > 0)}
              sessionId={sessionId!}
            />
          )}

          {activeTab === 'final' && (
            <div className="space-y-6">
              <h2 className="text-xl font-semibold text-slate-900">Final Review</h2>
              <div className="bg-slate-50 rounded-lg p-6">
                <div className="text-center">
                  <AlertTriangle className="mx-auto text-yellow-500 mb-4" size={48} />
                  <h3 className="text-lg font-medium text-slate-900 mb-2">
                    Ready for Final Storage
                  </h3>
                  <p className="text-slate-600 mb-6">
                    Review all documents and extracted data before saving to the master record.
                  </p>
                  <div className="flex justify-center space-x-4">
                    <button
                      onClick={handleFreezeSession}
                      className="bg-yellow-600 text-white px-6 py-3 rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2"
                    >
                      <Lock size={20} />
                      <span>Freeze Session</span>
                    </button>
                    <button
                      onClick={handleSaveSession}
                      className="bg-green-600 text-white px-6 py-3 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                    >
                      <Save size={20} />
                      <span>Save to Master Record</span>
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Document Viewer Modal */}
      {selectedDocument && (
        <DocumentViewer
          documentId={selectedDocument}
          onClose={() => setSelectedDocument(null)}
        />
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
          <div className="bg-white rounded-2xl shadow-xl max-w-md w-full p-6">
            <div className="flex items-center space-x-3 mb-4">
              <div className="bg-red-100 p-2 rounded-lg">
                <AlertTriangle className="text-red-600" size={24} />
              </div>
              <div>
                <h3 className="text-lg font-semibold text-slate-900">Delete Document</h3>
                <p className="text-sm text-slate-600">This action cannot be undone</p>
              </div>
            </div>
            
            <p className="text-slate-700 mb-6">
              Are you sure you want to delete this document? The file will be permanently removed from the system.
            </p>
            
            <div className="flex space-x-3">
              <button
                onClick={() => setShowDeleteConfirm(null)}
                className="flex-1 px-4 py-2 border border-slate-300 text-slate-700 rounded-lg hover:bg-slate-50 transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={() => handleDeleteDocument(showDeleteConfirm)}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default SessionDetail;