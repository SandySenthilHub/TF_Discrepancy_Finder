import axios from 'axios';

const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:3000/api';

// Create axios instance with default config
const api = axios.create({
  baseURL: API_BASE_URL,
  timeout: 30000,
  headers: {
    'Content-Type': 'application/json',
  },
});

// Add auth token to requests
api.interceptors.request.use((config) => {
  const token = localStorage.getItem('auth_token');
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

// Handle auth errors and provide better error messages
api.interceptors.response.use(
  (response) => response,
  (error) => {
    // Handle network errors
    if (!error.response) {
      console.error('Network error:', error.message);
      error.message = 'Network error. Please check if the server is running.';
    }
    
    // Handle auth errors
    if (error.response?.status === 401) {
      localStorage.removeItem('auth_token');
      localStorage.removeItem('user');
      window.location.href = '/';
    }
    
    return Promise.reject(error);
  }
);

// Auth API
export const authAPI = {
  login: async (email: string, password: string) => {
    try {
      const response = await api.post('/auth/login', { email, password });
      return response.data;
    } catch (error: any) {
      console.error('Login API error:', error);
      throw error;
    }
  },
  
  register: async (userData: { email: string; name: string; password: string; role?: string }) => {
    try {
      const response = await api.post('/auth/register', userData);
      return response.data;
    } catch (error: any) {
      console.error('Register API error:', error);
      throw error;
    }
  },
  
  verify: async () => {
    try {
      const response = await api.get('/auth/verify');
      return response.data;
    } catch (error: any) {
      console.error('Verify API error:', error);
      throw error;
    }
  },
};

// Sessions API
export const sessionsAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/sessions');
      return response.data;
    } catch (error: any) {
      console.error('Get sessions API error:', error);
      throw error;
    }
  },
  
  create: async (sessionData: { cifNumber: string; lcNumber: string; lifecycle: string }) => {
    try {
      const response = await api.post('/sessions', sessionData);
      return response.data;
    } catch (error: any) {
      console.error('Create session API error:', error);
      throw error;
    }
  },
  
  getById: async (sessionId: string) => {
    try {
      const response = await api.get(`/sessions/${sessionId}`);
      return response.data;
    } catch (error: any) {
      console.error('Get session by ID API error:', error);
      throw error;
    }
  },
  
  updateStatus: async (sessionId: string, status: string) => {
    try {
      const response = await api.patch(`/sessions/${sessionId}/status`, { status });
      return response.data;
    } catch (error: any) {
      console.error('Update session status API error:', error);
      throw error;
    }
  },
  
  incrementIteration: async (sessionId: string) => {
    try {
      const response = await api.patch(`/sessions/${sessionId}/iterate`);
      return response.data;
    } catch (error: any) {
      console.error('Increment iteration API error:', error);
      throw error;
    }
  },

  delete: async (sessionId: string) => {
    try {
      const response = await api.delete(`/sessions/${sessionId}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete session API error:', error);
      throw error;
    }
  },
};

// Documents API
export const documentsAPI = {
  upload: async (sessionId: string, file: File) => {
    try {
      const formData = new FormData();
      formData.append('document', file);
      
      const response = await api.post(`/documents/upload/${sessionId}`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000, // 60 seconds for file uploads
      });
      return response.data;
    } catch (error: any) {
      console.error('Upload document API error:', error);
      throw error;
    }
  },
  
  getBySession: async (sessionId: string) => {
    try {
      const response = await api.get(`/documents/session/${sessionId}`);
      return response.data;
    } catch (error: any) {
      console.error('Get documents by session API error:', error);
      throw error;
    }
  },
  
  process: async (documentId: string) => {
    try {
      const response = await api.post(`/documents/${documentId}/process`);
      return response.data;
    } catch (error: any) {
      console.error('Process document API error:', error);
      throw error;
    }
  },

  delete: async (documentId: string) => {
    try {
      const response = await api.delete(`/documents/${documentId}`);
      return response.data;
    } catch (error: any) {
      console.error('Delete document API error:', error);
      throw error;
    }
  },

  compareDocument: async (documentId: string) => {
    try {
      const response = await api.post(`/documents/${documentId}/compare`);
      return response.data;
    } catch (error: any) {
      console.error('Compare document API error:', error);
      throw error;
    }
  },

  catalogDocument: async (documentId: string, templateId: string) => {
    try {
      const response = await api.post(`/documents/${documentId}/catalog`, { templateId });
      return response.data;
    } catch (error: any) {
      console.error('Catalog document API error:', error);
      throw error;
    }
  },

  requestNewDocumentApproval: async (documentId: string, documentType: string) => {
    try {
      const response = await api.post(`/documents/${documentId}/request-approval`, { documentType });
      return response.data;
    } catch (error: any) {
      console.error('Request approval API error:', error);
      throw error;
    }
  },

  editDocument: async (documentId: string, changes: any) => {
    try {
      const response = await api.patch(`/documents/${documentId}`, changes);
      return response.data;
    } catch (error: any) {
      console.error('Edit document API error:', error);
      throw error;
    }
  },

  replaceDocument: async (documentId: string, newFile: File) => {
    try {
      const formData = new FormData();
      formData.append('document', newFile);
      
      const response = await api.put(`/documents/${documentId}/replace`, formData, {
        headers: {
          'Content-Type': 'multipart/form-data',
        },
        timeout: 60000,
      });
      return response.data;
    } catch (error: any) {
      console.error('Replace document API error:', error);
      throw error;
    }
  },

  revertDocument: async (documentId: string) => {
    try {
      const response = await api.post(`/documents/${documentId}/revert`);
      return response.data;
    } catch (error: any) {
      console.error('Revert document API error:', error);
      throw error;
    }
  },

  saveToMasterRecord: async (sessionId: string) => {
    try {
      const response = await api.post(`/sessions/${sessionId}/save-master`);
      return response.data;
    } catch (error: any) {
      console.error('Save to master record API error:', error);
      throw error;
    }
  },
};

// OCR API
export const ocrAPI = {
  processDocument: async (documentId: string) => {
    try {
      const response = await api.post(`/ocr/process/${documentId}`);
      return response.data;
    } catch (error: any) {
      console.error('OCR process API error:', error);
      throw error;
    }
  },

  reprocessDocument: async (documentId: string) => {
    try {
      const response = await api.post(`/ocr/reprocess/${documentId}`);
      return response.data;
    } catch (error: any) {
      console.error('OCR reprocess API error:', error);
      throw error;
    }
  },

  recognizeDocumentType: async (documentId: string) => {
    try {
      const response = await api.post(`/ocr/recognize/${documentId}`);
      return response.data;
    } catch (error: any) {
      console.error('Document recognition API error:', error);
      throw error;
    }
  },
};

// Fields API
export const fieldsAPI = {
  extractFields: async (documentId: string) => {
    try {
      const response = await api.post(`/fields/extract/${documentId}`);
      return response.data;
    } catch (error: any) {
      console.error('Extract fields API error:', error);
      throw error;
    }
  },

  updateField: async (fieldId: string, value: string) => {
    try {
      const response = await api.patch(`/fields/${fieldId}`, { value });
      return response.data;
    } catch (error: any) {
      console.error('Update field API error:', error);
      throw error;
    }
  },

  validateField: async (fieldId: string, isValid: boolean) => {
    try {
      const response = await api.patch(`/fields/${fieldId}/validate`, { isValid });
      return response.data;
    } catch (error: any) {
      console.error('Validate field API error:', error);
      throw error;
    }
  },

  getFieldsByDocument: async (documentId: string) => {
    try {
      const response = await api.get(`/fields/document/${documentId}`);
      return response.data;
    } catch (error: any) {
      console.error('Get fields by document API error:', error);
      throw error;
    }
  },
};

// Templates API
export const templatesAPI = {
  getAll: async () => {
    try {
      const response = await api.get('/templates');
      return response.data;
    } catch (error: any) {
      console.error('Get templates API error:', error);
      throw error;
    }
  },

  getMasterTemplates: async () => {
    try {
      const response = await api.get('/templates/master');
      return response.data;
    } catch (error: any) {
      console.error('Get master templates API error:', error);
      throw error;
    }
  },

  getSubTemplates: async () => {
    try {
      const response = await api.get('/templates/sub');
      return response.data;
    } catch (error: any) {
      console.error('Get sub templates API error:', error);
      throw error;
    }
  },
};

// Admin API
export const adminAPI = {
  getPendingApprovals: async () => {
    try {
      const response = await api.get('/admin/approvals');
      return response.data;
    } catch (error: any) {
      console.error('Get pending approvals API error:', error);
      throw error;
    }
  },

  approveDocument: async (approvalId: string, approved: boolean, notes?: string) => {
    try {
      const response = await api.patch(`/admin/approvals/${approvalId}`, { approved, notes });
      return response.data;
    } catch (error: any) {
      console.error('Approve document API error:', error);
      throw error;
    }
  },
};

// Health check
export const healthAPI = {
  check: async () => {
    try {
      const response = await api.get('/health');
      return response.data;
    } catch (error: any) {
      console.error('Health check API error:', error);
      throw error;
    }
  },
};

export default api;