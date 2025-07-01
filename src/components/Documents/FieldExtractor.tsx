import React, { useState, useEffect } from 'react';
import { Check, X, Edit, Save, RefreshCw, Eye, CheckCircle, AlertCircle } from 'lucide-react';
import { useDocumentStore } from '../../store/documentStore';
import { Document, ExtractedField } from '../../types';

interface FieldExtractorProps {
  documents: Document[];
  sessionId: string;
}

const FieldExtractor: React.FC<FieldExtractorProps> = ({ documents, sessionId }) => {
  const { extractFields, updateField, validateField, isLoading } = useDocumentStore();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const [processingDocument, setProcessingDocument] = useState<string | null>(null);

  const handleExtractFields = async (documentId: string) => {
    setProcessingDocument(documentId);
    try {
      await extractFields(documentId);
    } catch (error) {
      console.error('Error extracting fields:', error);
    } finally {
      setProcessingDocument(null);
    }
  };

  const handleEditField = (field: ExtractedField) => {
    setEditingField(field.id);
    setEditValue(field.fieldValue);
  };

  const handleSaveField = async (fieldId: string) => {
    try {
      await updateField(fieldId, editValue);
      setEditingField(null);
      setEditValue('');
    } catch (error) {
      console.error('Error updating field:', error);
    }
  };

  const handleValidateField = async (fieldId: string, isValid: boolean) => {
    try {
      await validateField(fieldId, isValid);
    } catch (error) {
      console.error('Error validating field:', error);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600 bg-green-100';
    if (confidence >= 0.7) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  const getDocumentProgress = (document: Document) => {
    if (!document.extractedFields || document.extractedFields.length === 0) {
      return { total: 0, validated: 0, percentage: 0 };
    }
    
    const total = document.extractedFields.length;
    const validated = document.extractedFields.filter(f => f.isValidated).length;
    const percentage = total > 0 ? Math.round((validated / total) * 100) : 0;
    
    return { total, validated, percentage };
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Field Extraction & Validation</h2>
        <p className="text-sm text-slate-600">
          Extract and validate fields from processed documents
        </p>
      </div>

      {documents.map((document) => {
        const progress = getDocumentProgress(document);
        
        return (
          <div key={document.id} className="bg-white rounded-lg border border-slate-200 shadow-sm">
            <div className="p-6 border-b border-slate-200">
              <div className="flex items-center justify-between mb-4">
                <div className="flex-1">
                  <h3 className="font-medium text-slate-900">{document.fileName}</h3>
                  <p className="text-sm text-slate-600">
                    Status: {document.status} • Fields: {document.extractedFields?.length || 0}
                  </p>
                  {progress.total > 0 && (
                    <div className="mt-2">
                      <div className="flex items-center justify-between text-sm">
                        <span className="text-slate-600">Validation Progress</span>
                        <span className="font-medium text-slate-900">
                          {progress.validated}/{progress.total} ({progress.percentage}%)
                        </span>
                      </div>
                      <div className="mt-1 w-full bg-slate-200 rounded-full h-2">
                        <div 
                          className="bg-green-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${progress.percentage}%` }}
                        />
                      </div>
                    </div>
                  )}
                </div>
                
                {(!document.extractedFields || document.extractedFields.length === 0) && (
                  <button
                    onClick={() => handleExtractFields(document.id)}
                    disabled={isLoading || processingDocument === document.id}
                    className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                  >
                    <RefreshCw size={16} className={processingDocument === document.id ? 'animate-spin' : ''} />
                    <span>Extract Fields</span>
                  </button>
                )}
              </div>
            </div>

            <div className="p-6">
              {document.extractedFields && document.extractedFields.length > 0 ? (
                <div className="space-y-4">
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {document.extractedFields.map((field) => (
                      <div key={field.id} className="bg-slate-50 rounded-lg p-4 border border-slate-200">
                        <div className="flex items-start justify-between mb-3">
                          <div className="flex-1">
                            <div className="flex items-center space-x-2 mb-2">
                              <h4 className="font-medium text-slate-900">{field.fieldName}</h4>
                              <span className={`text-xs font-medium px-2 py-1 rounded-full ${getConfidenceColor(field.confidence)}`}>
                                {Math.round(field.confidence * 100)}%
                              </span>
                              {field.isValidated && (
                                <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full flex items-center space-x-1">
                                  <CheckCircle size={12} />
                                  <span>Validated</span>
                                </span>
                              )}
                              {field.isEdited && (
                                <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                                  Edited
                                </span>
                              )}
                            </div>
                            
                            {editingField === field.id ? (
                              <div className="space-y-2">
                                <input
                                  type="text"
                                  value={editValue}
                                  onChange={(e) => setEditValue(e.target.value)}
                                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                  onKeyPress={(e) => {
                                    if (e.key === 'Enter') {
                                      handleSaveField(field.id);
                                    }
                                  }}
                                />
                                <div className="flex items-center space-x-2">
                                  <button
                                    onClick={() => handleSaveField(field.id)}
                                    className="bg-green-600 text-white px-3 py-1 rounded text-sm hover:bg-green-700 transition-colors flex items-center space-x-1"
                                  >
                                    <Save size={14} />
                                    <span>Save</span>
                                  </button>
                                  <button
                                    onClick={() => {
                                      setEditingField(null);
                                      setEditValue('');
                                    }}
                                    className="bg-slate-600 text-white px-3 py-1 rounded text-sm hover:bg-slate-700 transition-colors flex items-center space-x-1"
                                  >
                                    <X size={14} />
                                    <span>Cancel</span>
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-center justify-between">
                                <p className="text-slate-700 flex-1 break-words">{field.fieldValue}</p>
                                <button
                                  onClick={() => handleEditField(field)}
                                  className="ml-2 text-slate-600 hover:text-blue-600 transition-colors p-1"
                                  title="Edit field"
                                >
                                  <Edit size={16} />
                                </button>
                              </div>
                            )}
                          </div>
                        </div>

                        {!field.isValidated && editingField !== field.id && (
                          <div className="flex items-center space-x-2 pt-3 border-t border-slate-200">
                            <button
                              onClick={() => handleValidateField(field.id, true)}
                              className="flex-1 bg-green-600 text-white py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center justify-center space-x-1"
                              title="Validate field as correct"
                            >
                              <Check size={16} />
                              <span>Validate</span>
                            </button>
                            <button
                              onClick={() => handleValidateField(field.id, false)}
                              className="flex-1 bg-red-600 text-white py-2 rounded-lg hover:bg-red-700 transition-colors flex items-center justify-center space-x-1"
                              title="Mark as incorrect"
                            >
                              <X size={16} />
                              <span>Reject</span>
                            </button>
                          </div>
                        )}

                        {field.position && (
                          <div className="mt-3 pt-3 border-t border-slate-200">
                            <div className="text-xs text-slate-500">
                              Position: ({field.position.x}, {field.position.y}) • 
                              Size: {field.position.width}×{field.position.height}
                            </div>
                          </div>
                        )}
                      </div>
                    ))}
                  </div>

                  {/* Summary */}
                  <div className="mt-6 p-4 bg-blue-50 rounded-lg border border-blue-200">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        {progress.percentage === 100 ? (
                          <CheckCircle className="text-green-600" size={20} />
                        ) : (
                          <AlertCircle className="text-blue-600" size={20} />
                        )}
                        <span className="font-medium text-slate-900">
                          {progress.percentage === 100 
                            ? 'All fields validated!' 
                            : `${progress.total - progress.validated} fields pending validation`
                          }
                        </span>
                      </div>
                      <span className="text-sm text-slate-600">
                        {progress.validated}/{progress.total} complete
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="text-center py-8">
                  <div className="text-slate-400 mb-4">
                    <Eye size={48} className="mx-auto" />
                  </div>
                  <h3 className="text-lg font-medium text-slate-900 mb-2">No fields extracted yet</h3>
                  <p className="text-slate-600 mb-4">
                    Click "Extract Fields" to analyze this document and extract key information.
                  </p>
                  <button
                    onClick={() => handleExtractFields(document.id)}
                    disabled={isLoading || processingDocument === document.id}
                    className="bg-blue-600 text-white px-6 py-3 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 mx-auto disabled:opacity-50"
                  >
                    <RefreshCw size={20} className={processingDocument === document.id ? 'animate-spin' : ''} />
                    <span>Extract Fields</span>
                  </button>
                </div>
              )}
            </div>
          </div>
        );
      })}

      {documents.length === 0 && (
        <div className="text-center py-12">
          <div className="text-slate-400 mb-4">
            <FileText size={48} className="mx-auto" />
          </div>
          <h3 className="text-lg font-medium text-slate-900 mb-2">No validated documents</h3>
          <p className="text-slate-600">
            Process and validate documents first to extract fields.
          </p>
        </div>
      )}
    </div>
  );
};

export default FieldExtractor;