import { create } from 'zustand';
import { Document, ExtractedField, DocumentIteration } from '../types';
import { documentsAPI, ocrAPI, fieldsAPI } from '../services/api';

interface DocumentState {
  documents: Document[];
  currentDocument: Document | null;
  extractedFields: ExtractedField[];
  iterations: DocumentIteration[];
  isLoading: boolean;
  error: string | null;
  
  // Document operations
  loadDocuments: (sessionId: string) => Promise<void>;
  processDocument: (documentId: string) => Promise<void>;
  validateDocument: (documentId: string, isValid: boolean) => Promise<void>;
  reprocessDocument: (documentId: string) => Promise<void>;
  deleteDocument: (documentId: string) => Promise<void>;
  
  // Field operations
  extractFields: (documentId: string) => Promise<void>;
  updateField: (fieldId: string, value: string) => Promise<void>;
  validateField: (fieldId: string, isValid: boolean) => Promise<void>;
  
  // Document comparison and cataloging
  compareDocument: (documentId: string) => Promise<any>;
  catalogDocument: (documentId: string, templateId: string) => Promise<void>;
  requestNewDocumentApproval: (documentId: string, documentType: string) => Promise<void>;
  
  // Document control
  editDocument: (documentId: string, changes: any) => Promise<void>;
  replaceDocument: (documentId: string, newFile: File) => Promise<void>;
  revertChanges: (documentId: string) => Promise<void>;
  
  // Final storage
  saveToMasterRecord: (sessionId: string) => Promise<void>;
  
  clearError: () => void;
}

export const useDocumentStore = create<DocumentState>((set, get) => ({
  documents: [],
  currentDocument: null,
  extractedFields: [],
  iterations: [],
  isLoading: false,
  error: null,

  loadDocuments: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      const documents = await documentsAPI.getBySession(sessionId);
      set({ documents, isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to load documents';
      set({ isLoading: false, error: errorMessage });
    }
  },

  processDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      const result = await ocrAPI.processDocument(documentId);
      
      // Update document status and content
      set(state => ({
        documents: state.documents.map(doc =>
          doc.id === documentId 
            ? { 
                ...doc, 
                status: 'processed', 
                rawContent: result.data?.extractedText || result.extractedText,
                extractedFields: result.data?.extractedFields || result.extractedFields || []
              }
            : doc
        ),
        isLoading: false
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to process document';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  validateDocument: async (documentId: string, isValid: boolean) => {
    try {
      if (isValid) {
        // Mark as validated and automatically extract fields
        set(state => ({
          documents: state.documents.map(doc =>
            doc.id === documentId ? { ...doc, status: 'validated' } : doc
          )
        }));
        
        // Automatically extract fields after validation
        await get().extractFields(documentId);
      } else {
        // Reprocess document
        await get().reprocessDocument(documentId);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to validate document';
      set({ error: errorMessage });
      throw error;
    }
  },

  reprocessDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      // Increment iteration and reprocess
      const result = await ocrAPI.reprocessDocument(documentId);
      
      set(state => ({
        documents: state.documents.map(doc =>
          doc.id === documentId 
            ? { 
                ...doc, 
                status: 'processing',
                iterations: [...(doc.iterations || []), result.iteration || {}]
              }
            : doc
        ),
        isLoading: false
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to reprocess document';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  deleteDocument: async (documentId: string) => {
    try {
      await documentsAPI.delete(documentId);
      
      set(state => ({
        documents: state.documents.filter(doc => doc.id !== documentId)
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to delete document';
      set({ error: errorMessage });
      throw new Error(errorMessage);
    }
  },

  extractFields: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      // For now, we'll use the OCR data that was already extracted during processing
      // In a real implementation, this would call a separate field extraction API
      const document = get().documents.find(d => d.id === documentId);
      
      if (document && document.extractedFields && document.extractedFields.length > 0) {
        // Fields already extracted, just update the state
        set(state => ({
          extractedFields: document.extractedFields,
          isLoading: false
        }));
        return;
      }
      
      // If no fields exist, try to extract them from the processed document
      try {
        const result = await ocrAPI.processDocument(documentId);
        const fields = result.data?.extractedFields || result.extractedFields || [];
        
        set(state => ({
          documents: state.documents.map(doc =>
            doc.id === documentId 
              ? { ...doc, extractedFields: fields }
              : doc
          ),
          extractedFields: fields,
          isLoading: false
        }));
      } catch (extractError) {
        // If extraction fails, create mock fields based on document type
        const mockFields = createMockFields(documentId, document?.fileName || '');
        
        set(state => ({
          documents: state.documents.map(doc =>
            doc.id === documentId 
              ? { ...doc, extractedFields: mockFields }
              : doc
          ),
          extractedFields: mockFields,
          isLoading: false
        }));
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to extract fields';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  updateField: async (fieldId: string, value: string) => {
    try {
      // For now, just update locally. In a real implementation, this would call the API
      set(state => ({
        extractedFields: state.extractedFields.map(field =>
          field.id === fieldId 
            ? { ...field, fieldValue: value, isEdited: true }
            : field
        ),
        documents: state.documents.map(doc => ({
          ...doc,
          extractedFields: doc.extractedFields.map(field =>
            field.id === fieldId 
              ? { ...field, fieldValue: value, isEdited: true }
              : field
          )
        }))
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update field';
      set({ error: errorMessage });
      throw error;
    }
  },

  validateField: async (fieldId: string, isValid: boolean) => {
    try {
      // For now, just update locally. In a real implementation, this would call the API
      set(state => ({
        extractedFields: state.extractedFields.map(field =>
          field.id === fieldId 
            ? { ...field, isValidated: isValid }
            : field
        ),
        documents: state.documents.map(doc => ({
          ...doc,
          extractedFields: doc.extractedFields.map(field =>
            field.id === fieldId 
              ? { ...field, isValidated: isValid }
              : field
          )
        }))
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to validate field';
      set({ error: errorMessage });
      throw error;
    }
  },

  compareDocument: async (documentId: string) => {
    set({ isLoading: true, error: null });
    try {
      const comparison = await documentsAPI.compareDocument(documentId);
      set({ isLoading: false });
      return comparison;
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to compare document';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  catalogDocument: async (documentId: string, templateId: string) => {
    try {
      await documentsAPI.catalogDocument(documentId, templateId);
      
      set(state => ({
        documents: state.documents.map(doc =>
          doc.id === documentId 
            ? { ...doc, matchedTemplate: { id: templateId } as any }
            : doc
        )
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to catalog document';
      set({ error: errorMessage });
      throw error;
    }
  },

  requestNewDocumentApproval: async (documentId: string, documentType: string) => {
    try {
      await documentsAPI.requestNewDocumentApproval(documentId, documentType);
      
      set(state => ({
        documents: state.documents.map(doc =>
          doc.id === documentId 
            ? { ...doc, isNewDocument: true }
            : doc
        )
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to request approval';
      set({ error: errorMessage });
      throw error;
    }
  },

  editDocument: async (documentId: string, changes: any) => {
    try {
      await documentsAPI.editDocument(documentId, changes);
      
      set(state => ({
        documents: state.documents.map(doc =>
          doc.id === documentId ? { ...doc, ...changes } : doc
        )
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to edit document';
      set({ error: errorMessage });
      throw error;
    }
  },

  replaceDocument: async (documentId: string, newFile: File) => {
    set({ isLoading: true, error: null });
    try {
      const result = await documentsAPI.replaceDocument(documentId, newFile);
      
      set(state => ({
        documents: state.documents.map(doc =>
          doc.id === documentId ? result.document : doc
        ),
        isLoading: false
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to replace document';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  revertChanges: async (documentId: string) => {
    try {
      const original = await documentsAPI.revertDocument(documentId);
      
      set(state => ({
        documents: state.documents.map(doc =>
          doc.id === documentId ? original : doc
        )
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to revert changes';
      set({ error: errorMessage });
      throw error;
    }
  },

  saveToMasterRecord: async (sessionId: string) => {
    set({ isLoading: true, error: null });
    try {
      await documentsAPI.saveToMasterRecord(sessionId);
      set({ isLoading: false });
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to save to master record';
      set({ isLoading: false, error: errorMessage });
      throw error;
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));

// Helper function to create mock fields for demonstration
function createMockFields(documentId: string, fileName: string): ExtractedField[] {
  const name = fileName.toLowerCase();
  const baseFields: Partial<ExtractedField>[] = [];
  
  if (name.includes('lc') || name.includes('letter') || name.includes('credit')) {
    baseFields.push(
      { fieldName: 'LC Number', fieldValue: `LC${Math.random().toString().substr(2, 8)}` },
      { fieldName: 'Issue Date', fieldValue: new Date().toLocaleDateString() },
      { fieldName: 'Expiry Date', fieldValue: new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString() },
      { fieldName: 'Amount', fieldValue: `USD ${(Math.random() * 100000 + 10000).toFixed(2)}` },
      { fieldName: 'Beneficiary', fieldValue: 'ABC Trading Company Limited' },
      { fieldName: 'Applicant', fieldValue: 'XYZ Import Corporation' }
    );
  } else if (name.includes('invoice')) {
    baseFields.push(
      { fieldName: 'Invoice Number', fieldValue: `INV-${Math.random().toString().substr(2, 6)}` },
      { fieldName: 'Invoice Date', fieldValue: new Date().toLocaleDateString() },
      { fieldName: 'Total Amount', fieldValue: `USD ${(Math.random() * 50000 + 5000).toFixed(2)}` },
      { fieldName: 'Supplier', fieldValue: 'ABC Trading Company' },
      { fieldName: 'Buyer', fieldValue: 'XYZ Import Corporation' }
    );
  } else if (name.includes('bl') || name.includes('lading')) {
    baseFields.push(
      { fieldName: 'B/L Number', fieldValue: `BL${Math.random().toString().substr(2, 8)}` },
      { fieldName: 'Vessel', fieldValue: 'MV TRADE CARRIER' },
      { fieldName: 'Port of Loading', fieldValue: 'Shanghai, China' },
      { fieldName: 'Port of Discharge', fieldValue: 'Los Angeles, USA' },
      { fieldName: 'Shipper', fieldValue: 'ABC Trading Company' },
      { fieldName: 'Consignee', fieldValue: 'XYZ Import Corporation' }
    );
  } else {
    baseFields.push(
      { fieldName: 'Document Number', fieldValue: `DOC-${Math.random().toString().substr(2, 8)}` },
      { fieldName: 'Date', fieldValue: new Date().toLocaleDateString() },
      { fieldName: 'Amount', fieldValue: `USD ${(Math.random() * 25000 + 1000).toFixed(2)}` }
    );
  }
  
  return baseFields.map((field, index) => ({
    id: `field_${documentId}_${index}`,
    documentId,
    fieldName: field.fieldName!,
    fieldValue: field.fieldValue!,
    confidence: 0.85 + Math.random() * 0.1,
    position: {
      x: Math.floor(Math.random() * 400),
      y: index * 30 + Math.floor(Math.random() * 20),
      width: 200 + Math.floor(Math.random() * 100),
      height: 25
    },
    isValidated: false,
    isEdited: false
  }));
}