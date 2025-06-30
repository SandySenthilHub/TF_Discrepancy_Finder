import React, { useState, useEffect } from 'react';
import { Search, CheckCircle, AlertTriangle, Plus, Eye } from 'lucide-react';
import { useDocumentStore } from '../../store/documentStore';
import { Document } from '../../types';

interface DocumentComparatorProps {
  documents: Document[];
  sessionId: string;
}

interface TemplateMatch {
  id: string;
  name: string;
  type: 'master' | 'sub';
  confidence: number;
  matchedFields: number;
  totalFields: number;
}

const DocumentComparator: React.FC<DocumentComparatorProps> = ({ documents, sessionId }) => {
  const { compareDocument, catalogDocument, requestNewDocumentApproval, isLoading } = useDocumentStore();
  const [comparisons, setComparisons] = useState<Record<string, TemplateMatch[]>>({});
  const [selectedMatches, setSelectedMatches] = useState<Record<string, string>>({});
  const [newDocumentTypes, setNewDocumentTypes] = useState<Record<string, string>>({});

  const handleCompareDocument = async (documentId: string) => {
    try {
      const result = await compareDocument(documentId);
      setComparisons(prev => ({
        ...prev,
        [documentId]: result.matches
      }));
    } catch (error) {
      console.error('Error comparing document:', error);
    }
  };

  const handleSelectTemplate = (documentId: string, templateId: string) => {
    setSelectedMatches(prev => ({
      ...prev,
      [documentId]: templateId
    }));
  };

  const handleCatalogDocument = async (documentId: string) => {
    const templateId = selectedMatches[documentId];
    if (templateId) {
      await catalogDocument(documentId, templateId);
    }
  };

  const handleRequestNewDocument = async (documentId: string) => {
    const documentType = newDocumentTypes[documentId];
    if (documentType) {
      await requestNewDocumentApproval(documentId, documentType);
    }
  };

  const getConfidenceColor = (confidence: number) => {
    if (confidence >= 0.8) return 'text-green-600 bg-green-100';
    if (confidence >= 0.6) return 'text-yellow-600 bg-yellow-100';
    return 'text-red-600 bg-red-100';
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h2 className="text-xl font-semibold text-slate-900">Document Comparison & Cataloging</h2>
        <p className="text-sm text-slate-600">
          Compare documents against 40 master and 192 sub-document templates
        </p>
      </div>

      {documents.map((document) => (
        <div key={document.id} className="bg-white rounded-lg border border-slate-200 p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h3 className="font-medium text-slate-900">{document.fileName}</h3>
              <p className="text-sm text-slate-600">
                Fields extracted: {document.extractedFields?.length || 0}
              </p>
            </div>
            
            {!comparisons[document.id] && (
              <button
                onClick={() => handleCompareDocument(document.id)}
                disabled={isLoading}
                className="bg-blue-600 text-white px-4 py-2 rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
              >
                <Search size={16} />
                <span>Compare Templates</span>
              </button>
            )}
          </div>

          {comparisons[document.id] && (
            <div className="space-y-4">
              <h4 className="font-medium text-slate-900">Template Matches</h4>
              
              {comparisons[document.id].length > 0 ? (
                <div className="space-y-3">
                  {comparisons[document.id].map((match) => (
                    <div
                      key={match.id}
                      className={`p-4 rounded-lg border-2 cursor-pointer transition-all ${
                        selectedMatches[document.id] === match.id
                          ? 'border-blue-500 bg-blue-50'
                          : 'border-slate-200 hover:border-slate-300'
                      }`}
                      onClick={() => handleSelectTemplate(document.id, match.id)}
                    >
                      <div className="flex items-center justify-between">
                        <div className="flex-1">
                          <div className="flex items-center space-x-2 mb-1">
                            <h5 className="font-medium text-slate-900">{match.name}</h5>
                            <span className={`text-xs px-2 py-1 rounded-full ${
                              match.type === 'master' 
                                ? 'bg-purple-100 text-purple-800' 
                                : 'bg-blue-100 text-blue-800'
                            }`}>
                              {match.type}
                            </span>
                          </div>
                          <p className="text-sm text-slate-600">
                            Fields matched: {match.matchedFields}/{match.totalFields}
                          </p>
                        </div>
                        <div className="text-right">
                          <span className={`text-sm font-medium px-2 py-1 rounded-full ${getConfidenceColor(match.confidence)}`}>
                            {Math.round(match.confidence * 100)}%
                          </span>
                        </div>
                      </div>
                    </div>
                  ))}

                  {selectedMatches[document.id] && (
                    <div className="flex justify-end">
                      <button
                        onClick={() => handleCatalogDocument(document.id)}
                        className="bg-green-600 text-white px-4 py-2 rounded-lg hover:bg-green-700 transition-colors flex items-center space-x-2"
                      >
                        <CheckCircle size={16} />
                        <span>Catalog Document</span>
                      </button>
                    </div>
                  )}
                </div>
              ) : (
                <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                  <div className="flex items-start space-x-3">
                    <AlertTriangle className="text-yellow-600 mt-0.5" size={20} />
                    <div className="flex-1">
                      <h5 className="font-medium text-yellow-800 mb-2">No Template Matches Found</h5>
                      <p className="text-sm text-yellow-700 mb-3">
                        This document doesn't match any existing templates. Request approval for a new document type.
                      </p>
                      
                      <div className="flex items-center space-x-2">
                        <input
                          type="text"
                          placeholder="Enter document type name"
                          value={newDocumentTypes[document.id] || ''}
                          onChange={(e) => setNewDocumentTypes(prev => ({
                            ...prev,
                            [document.id]: e.target.value
                          }))}
                          className="flex-1 px-3 py-2 border border-yellow-300 rounded-lg focus:ring-2 focus:ring-yellow-500 focus:border-transparent"
                        />
                        <button
                          onClick={() => handleRequestNewDocument(document.id)}
                          disabled={!newDocumentTypes[document.id]}
                          className="bg-yellow-600 text-white px-4 py-2 rounded-lg hover:bg-yellow-700 transition-colors flex items-center space-x-2 disabled:opacity-50"
                        >
                          <Plus size={16} />
                          <span>Request Approval</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {document.matchedTemplate && (
            <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <CheckCircle className="text-green-600" size={20} />
                <span className="font-medium text-green-800">
                  Document cataloged as: {document.matchedTemplate.name}
                </span>
              </div>
            </div>
          )}

          {document.isNewDocument && (
            <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-center space-x-2">
                <Eye className="text-blue-600" size={20} />
                <span className="font-medium text-blue-800">
                  New document type requested - Pending admin approval
                </span>
              </div>
            </div>
          )}
        </div>
      ))}

      {documents.length === 0 && (
        <div className="text-center py-12 text-slate-500">
          <p>No documents with extracted fields available for comparison.</p>
          <p className="text-sm mt-1">Extract fields from documents first.</p>
        </div>
      )}
    </div>
  );
};

export default DocumentComparator;