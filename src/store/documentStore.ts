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
      
      // Update document status
      set(state => ({
        documents: state.documents.map(doc =>
          doc.id === documentId 
            ? { ...doc, status: 'processed', rawContent: result.extractedText }
            : doc
        ),
        isLoading: false
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to process document';
      set({ isLoading: false, error: errorMessage });
    }
  },

  validateDocument: async (documentId: string, isValid: boolean) => {
    try {
      if (isValid) {
        // Mark as validated
        set(state => ({
          documents: state.documents.map(doc =>
            doc.id === documentId ? { ...doc, status: 'validated' } : doc
          )
        }));
      } else {
        // Reprocess document
        await get().reprocessDocument(documentId);
      }
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to validate document';
      set({ error: errorMessage });
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
                iterations: [...(doc.iterations || []), result.iteration]
              }
            : doc
        ),
        isLoading: false
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to reprocess document';
      set({ isLoading: false, error: errorMessage });
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
      const fields = await fieldsAPI.extractFields(documentId);
      
      set(state => ({
        documents: state.documents.map(doc =>
          doc.id === documentId 
            ? { ...doc, extractedFields: fields }
            : doc
        ),
        extractedFields: fields,
        isLoading: false
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to extract fields';
      set({ isLoading: false, error: errorMessage });
    }
  },

  updateField: async (fieldId: string, value: string) => {
    try {
      await fieldsAPI.updateField(fieldId, value);
      
      set(state => ({
        extractedFields: state.extractedFields.map(field =>
          field.id === fieldId 
            ? { ...field, fieldValue: value, isEdited: true }
            : field
        )
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to update field';
      set({ error: errorMessage });
    }
  },

  validateField: async (fieldId: string, isValid: boolean) => {
    try {
      await fieldsAPI.validateField(fieldId, isValid);
      
      set(state => ({
        extractedFields: state.extractedFields.map(field =>
          field.id === fieldId 
            ? { ...field, isValidated: isValid }
            : field
        )
      }));
    } catch (error: any) {
      const errorMessage = error.response?.data?.error || error.message || 'Failed to validate field';
      set({ error: errorMessage });
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
    }
  },

  clearError: () => {
    set({ error: null });
  },
}));