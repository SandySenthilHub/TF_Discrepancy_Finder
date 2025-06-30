import React, { useState, useEffect } from 'react';
import { Check, X, Edit, Save, RefreshCw } from 'lucide-react';
import { useDocumentStore } from '../../store/documentStore';
import { Document, ExtractedField } from '../../types';

interface FieldExtractorProps {
  documents: Document[];
  sessionId: string;
}

const FieldExtractor: React.FC<FieldExtractorProps> = ({ documents, sessionId }) => {
  const { extractFields, updateField, validateField, extractedFields, isLoading } = useDocumentStore();
  const [editingField, setEditingField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  const handleExtractFields = async (documentId: string) => {
    await extractFields(documentId);
  };

  const handleEditField = (field: ExtractedField) => {
    setEditingField(field.id);
    setEditValue(field.fieldValue);
  };

  const handleSaveField = async (fieldId: string) => {
    await updateField(fieldId, editValue);
    setEditingField(null);
    setEditValue('');
  };

  const handleValidateField = async (fieldId: string, isValid: boolean) => {
    await validateField(fieldId, isValid);
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.9) return 'text-green-600';
    if (confidence >= 0.7) return 'text-yellow-600';
    return 'text-red-600';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Field Extraction</h2>
        <p className="text-sm text-slate-600">
          Extract and validate fields from processed documents
        </p>
      </div>

      {documents.map((document) => (
        <div key={document.id} className="bg-slate-50 rounded-lg p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-slate-900">{document.fileName}</h3>
              <p className="text-sm text-slate-600">
                Status: {document.status} • Fields: {document.extractedFields?.length || 0}
              </p>
            </div>
            
            {document.extractedFields?.length === 0 && (
              <button
                onClick={() => handleExtractFields(document.id)}
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <RefreshCw size={16} className={isLoading ? 'animate-spin' : ''} />
                <span>Extract Fields</span>
              </button>
            )}
          </div>

          {document.extractedFields && document.extractedFields.length > 0 && (
            <div className="space-y-3">
              {document.extractedFields.map((field) => (
                <div key={field.id} className="bg-white rounded-lg p-4 border border-slate-200">
                  <div className="flex items-start justify-between">
                    <div className="flex-1">
                      <div className="flex items-center space-x-2 mb-2">
                        <h4 className="font-medium text-slate-900">{field.fieldName}</h4>
                        <span className={`text-sm font-medium ${getConfidenceColor(field.confidence)}`}>
                          {Math.round(field.confidence * 100)}%
                        </span>
                        {field.isValidated && (
                          <span className="bg-green-100 text-green-800 text-xs px-2 py-1 rounded-full">
                            Validated
                          </span>
                        )}
                        {field.isEdited && (
                          <span className="bg-blue-100 text-blue-800 text-xs px-2 py-1 rounded-full">
                            Edited
                          </span>
                        )}
                      </div>
                      
                      {editingField === field.id ? (
                        <div className="flex items-center space-x-2">
                          <input
                            type="text"
                            value={editValue}
                            onChange={(e) => setEditValue(e.target.value)}
                            className="flex-1 px-3 py-2 border border-slate-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          />
                          <button
                            onClick={() => handleSaveField(field.id)}
                            className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors"
                          >
                            <Save size={16} />
                          </button>
                          <button
                            onClick={() => setEditingField(null)}
                            className="bg-slate-600 text-white p-2 rounded-lg hover:bg-slate-700 transition-colors"
                          >
                            <X size={16} />
                          </button>
                        </div>
                      ) : (
                        <div className="flex items-center space-x-2">
                          <p className="text-slate-700 flex-1">{field.fieldValue}</p>
                          <button
                            onClick={() => handleEditField(field)}
                            className="text-slate-600 hover:text-blue-600 transition-colors"
                          >
                            <Edit size={16} />
                          </button>
                        </div>
                      )}
                    </div>

                    {!field.isValidated && editingField !== field.id && (
                      <div className="flex items-center space-x-2 ml-4">
                        <button
                          onClick={() => handleValidateField(field.id, true)}
                          className="bg-green-600 text-white p-2 rounded-lg hover:bg-green-700 transition-colors"
                          title="Validate field"
                        >
                          <Check size={16} />
                        </button>
                        <button
                          onClick={() => handleValidateField(field.id, false)}
                          className="bg-red-600 text-white p-2 rounded-lg hover:bg-red-700 transition-colors"
                          title="Mark as incorrect"
                        >
                          <X size={16} />
                        </button>
                      </div>
                    )}
                  </div>

                  {field.position && (
                    <div className="mt-2 text-xs text-slate-500">
                      Position: ({field.position.x}, {field.position.y}) • 
                      Size: {field.position.width}×{field.position.height}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}

          {document.extractedFields?.length === 0 && (
            <div className="text-center py-8 text-slate-500">
              <p>No fields extracted yet. Click "Extract Fields" to begin.</p>
            </div>
          )}
        </div>
      ))}

      {documents.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No validated documents available for field extraction.</p>
          <p className="text-sm mt-1">Process and validate documents first.</p>
        </div>
      )}
    </div>
  );
};

export default FieldExtractor;