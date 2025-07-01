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
  Settings,
  Play,
  CheckCircle
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
  const [processingSteps, setProcessingSteps] = useState<Record<string, string>>({});

  useEffect(() => {
    if (sessionId) {
      loadDocuments(sessionId);
    }
  }, [sessionId, loadDocuments]);

  const handleProcessDocument = async (documentId: string) => {
    setIsProcessing(true);
    setProcessingSteps(prev => ({ ...prev, [documentId]: 'processing' }));
    
    try {
      await processDocument(documentId);
      setProcessingSteps(prev => ({ ...prev, [documentId]: 'processed' }));
      await updateSessionStatus(sessionId!, 'processing');
    } catch (error) {
      console.error('Error processing document:', error);
      setProcessingSteps(prev => ({ ...prev, [documentId]: 'error' }));
    } finally {
      setIsProcessing(false);
    }
  };

  const handleValidateDocument = async (documentId: string, isValid: boolean) => {
    try {
      setProcessingSteps(prev => ({ ...prev, [documentId]: 'validating' }));
      
      if (isValid) {
        // Mark as validated and automatically extract fields
        await validateDocument(documentId, true);
        setProcessingSteps(prev => ({ ...prev, [documentId]: 'validated' }));
        
        // Automatically start field extraction
        setTimeout(async () => {
          try {
            setProcessingSteps(prev => ({ ...prev, [documentId]: 'extracting-fields' }));
            await extractFields(documentId);
            setProcessingSteps(prev => ({ ...prev, [documentId]: 'fields-extracted' }));
            
            // Check if all documents are processed and move to next tab
            const allDocumentsProcessed = documents.every(doc => 
              doc.id === documentId || doc.status === 'validated' || doc.extractedFields?.length > 0
            );
            
            if (allDocumentsProcessed) {
              setActiveTab('fields');
              await updateSessionStatus(sessionId!, 'reviewing');
            }
          } catch (error) {
            console.error('Error extracting fields:', error);
            setProcessingSteps(prev => ({ ...prev, [documentId]: 'field-extraction-error' }));
          }
        }, 1000);
      } else {
        // Reprocess document
        setProcessingSteps(prev => ({ ...prev, [documentId]: 'reprocessing' }));
        await handleProcessDocument(documentId);
      }
    } catch (error) {
      console.error('Error validating document:', error);
      setProcessingSteps(prev => ({ ...prev, [documentId]: 'validation-error' }));
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

  const handleProcessAllDocuments = async () => {
    setIsProcessing(true);
    const unprocessedDocs = documents.filter(doc => doc.status === 'uploaded');
    
    for (const doc of unprocessedDocs) {
      await handleProcessDocument(doc.id);
    }
    
    setIsProcessing(false);
  };

  const handleValidateAllDocuments = async () => {
    const processedDocs = documents.filter(doc => doc.status === 'processed');
    
    for (const doc of processedDocs) {
      await handleValidateDocument(doc.id, true);
    }
  };

  const handleCompareAllDocuments = async () => {
    setIsProcessing(true);
    const docsWithFields = documents.filter(doc => doc.extractedFields?.length > 0);
    
    for (const doc of docsWithFields) {
      try {
        await compareDocument(doc.id);
      } catch (error) {
        console.error('Error comparing document:', error);
      }
    }
    
    setIsProcessing(false);
    setActiveTab('review');
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

  const getProcessingStepColor = (step: string) => {
    switch (step) {
      case 'processing': return 'bg-yellow-100 text-yellow-800';
      case 'processed': return 'bg-green-100 text-green-800';
      case 'validating': return 'bg-blue-100 text-blue-800';
      case 'validated': return 'bg-emerald-100 text-emerald-800';
      case 'extracting-fields': return 'bg-purple-100 text-purple-800';
      case 'fields-extracted': return 'bg-green-100 text-green-800';
      case 'error': return 'bg-red-100 text-red-800';
      default: return 'bg-slate-100 text-slate-800';
    }
  };

  const getProgressPercentage = () => {
    if (documents.length === 0) return 0;
    
    const uploadedCount = documents.length;
    const processedCount = documents.filter(d => d.status === 'processed' || d.status === 'validated').length;
    const validatedCount = documents.filter(d => d.status === 'validated').length;
    const fieldsExtractedCount = documents.filter(d => d.extractedFields?.length > 0).length;
    
    if (currentSession?.status === 'completed') return 100;
    if (fieldsExtractedCount === documents.length && fieldsExtractedCount > 0) return 85;
    if (validatedCount === documents.length && validatedCount > 0) return 70;
    if (processedCount === documents.length && processedCount > 0) return 50;
    if (uploadedCount > 0) return 25;
    
    return 10;
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

  const progressPercentage = getProgressPercentage();

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

      {/* Enhanced Progress Steps */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <div className="mb-4">
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-slate-900">Processing Progress</h3>
            <span className="text-sm font-medium text-slate-600">{progressPercentage}% Complete</span>
          </div>
          <div className="w-full bg-slate-200 rounded-full h-3">
            <div 
              className="bg-gradient-to-r from-blue-500 to-green-500 h-3 rounded-full transition-all duration-500"
              style={{ width: `${progressPercentage}%` }}
            />
          </div>
        </div>
        
        <div className="flex items-center justify-between">
          {[
            { step: 1, label: 'Upload', status: documents.length > 0 ? 'completed' : 'pending', count: documents.length },
            { step: 2, label: 'OCR Process', status: documents.some(d => d.status === 'processed' || d.status === 'validated') ? 'completed' : 'pending', count: documents.filter(d => d.status === 'processed' || d.status === 'validated').length },
            { step: 3, label: 'Validate', status: documents.some(d => d.status === 'validated') ? 'completed' : 'pending', count: documents.filter(d => d.status === 'validated').length },
            { step: 4, label: 'Extract Fields', status: documents.some(d => d.extractedFields?.length > 0) ? 'completed' : 'pending', count: documents.filter(d => d.extractedFields?.length > 0).length },
            { step: 5, label: 'Compare & Catalog', status: 'pending', count: 0 },
            { step: 6, label: 'Review', status: 'pending', count: 0 },
            { step: 7, label: 'Final Storage', status: currentSession?.status === 'completed' ? 'completed' : 'pending', count: currentSession?.status === 'completed' ? 1 : 0 }
          ].map((item, index) => (
            <div key={item.step} className="flex items-center">
              <div className="text-center">
                <div className={`w-12 h-12 rounded-full flex items-center justify-center text-sm font-medium mb-2 ${
                  item.status === 'completed' 
                    ? 'bg-green-500 text-white' 
                    : 'bg-slate-200 text-slate-600'
                }`}>
                  {item.status === 'completed' ? <Check size={16} /> : item.step}
                </div>
                <span className="text-sm font-medium text-slate-700">{item.label}</span>
                <div className="text-xs text-slate-500 mt-1">
                  {item.count > 0 && `${item.count}/${documents.length}`}
                </div>
              </div>
              {index < 6 && (
                <div className={`w-16 h-0.5 mx-2 ${
                  item.status === 'completed' ? 'bg-green-500' : 'bg-slate-200'
                }`} />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-6">
        <h3 className="text-lg font-semibold text-slate-900 mb-4">Quick Actions</h3>
        <div className="flex flex-wrap gap-3">
          {documents.some(d => d.status === 'uploaded') && (
            <button
              onClick={handleProcessAllDocuments}
              disabled={isProcessing}
              className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <Play size={16} />
              <span>Process All Documents</span>
            </button>
          )}
          
          {documents.some(d => d.status === 'processed') && (
            <button
              onClick={handleValidateAllDocuments}
              disabled={isProcessing}
              className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <CheckCircle size={16} />
              <span>Validate All Documents</span>
            </button>
          )}
          
          {documents.some(d => d.extractedFields?.length > 0) && (
            <button
              onClick={handleCompareAllDocuments}
              disabled={isProcessing}
              className="bg-purple-600 text-white px-4 py-2 rounded-lg hover:bg-purple-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
            >
              <Settings size={16} />
              <span>Compare All Documents</span>
            </button>
          )}
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="bg-white rounded-xl shadow-sm border border-slate-200">
        <div className="border-b border-slate-200">
          <nav className="flex space-x-8 px-6">
            {[
              { id: 'documents', label: 'Documents', icon: FileText, count: documents.length },
              { id: 'fields', label: 'Field Extraction', icon: Settings, count: documents.filter(d => d.extractedFields?.length > 0).length },
              { id: 'review', label: 'Review & Edit', icon: Eye, count: 0 },
              { id: 'final', label: 'Final Review', icon: Check, count: 0 }
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
                {tab.count > 0 && (
                  <span className="bg-slate-100 text-slate-600 text-xs px-2 py-1 rounded-full">
                    {tab.count}
                  </span>
                )}
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
                      <div className="flex flex-col items-end space-y-1">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getStatusColor(document.status)}`}>
                          {document.status}
                        </span>
                        {processingSteps[document.id] && (
                          <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getProcessingStepColor(processingSteps[document.id])}`}>
                            {processingSteps[document.id].replace('-', ' ')}
                          </span>
                        )}
                      </div>
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
                            title="Validate & Extract Fields"
                          >
                            <Check size={16} />
                          </button>
                          <button
                            onClick={() => handleValidateDocument(document.id, false)}
                            className="bg-red-600 text-white px-3 py-2 rounded text-sm hover:bg-red-700 transition-colors"
                            title="Reject & Reprocess"
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

                    {document.extractedFields && document.extractedFields.length > 0 && (
                      <div className="mt-3 pt-3 border-t border-slate-200">
                        <p className="text-xs text-slate-500">
                          Fields extracted: {document.extractedFields.length}
                        </p>
                      </div>
                    )}

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
              documents={documents.filter(d => d.status === 'validated' || d.extractedFields?.length > 0)}
              sessionId={sessionId!}
            />
          )}

          {activeTab === 'review' && (
            <DocumentComparator 
              documents={documents.filter(d => d.extractedFields?.length > 0)}
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