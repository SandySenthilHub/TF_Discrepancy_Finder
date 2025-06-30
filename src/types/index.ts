export interface User {
  id: string;
  email: string;
  name: string;
  role: 'user' | 'admin';
  createdAt: string;
}

export interface Session {
  id: string;
  cifNumber: string;
  lcNumber: string;
  lifecycle: string;
  status: 'created' | 'uploading' | 'processing' | 'reviewing' | 'completed' | 'frozen';
  createdAt: string;
  updatedAt: string;
  userId: string;
  documents: Document[];
  iterations: number;
}

export interface Document {
  id: string;
  sessionId: string;
  fileName: string;
  fileType: string;
  fileSize: number;
  filePath?: string;
  uploadedAt: string;
  status: 'uploaded' | 'processing' | 'processed' | 'validated' | 'error';
  rawContent?: string;
  cleanedContent?: string;
  extractedFields: ExtractedField[];
  matchedTemplate?: DocumentTemplate;
  isNewDocument: boolean;
  iterations: DocumentIteration[];
}

export interface DocumentIteration {
  id: string;
  documentId: string;
  iterationNumber: number;
  ocrResult: string;
  extractedFields: ExtractedField[];
  createdAt: string;
  status: 'processing' | 'completed' | 'failed';
}

export interface ExtractedField {
  id: string;
  documentId: string;
  fieldName: string;
  fieldValue: string;
  confidence: number;
  position: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
  isValidated: boolean;
  isEdited: boolean;
}

export interface DocumentTemplate {
  id: string;
  name: string;
  type: 'master' | 'sub';
  category: string;
  fields: TemplateField[];
  isActive: boolean;
  createdAt: string;
}

export interface TemplateField {
  id: string;
  templateId: string;
  fieldName: string;
  fieldType: 'text' | 'number' | 'date' | 'currency';
  isRequired: boolean;
  validationRules?: string;
  position?: {
    x: number;
    y: number;
    width: number;
    height: number;
  };
}

export interface PendingApproval {
  id: string;
  type: 'document' | 'field';
  documentId?: string;
  fieldId?: string;
  requestedBy: string;
  requestedAt: string;
  status: 'pending' | 'approved' | 'rejected';
  adminNotes?: string;
  approvedBy?: string;
  approvedAt?: string;
}

export interface KeyValuePair {
  id: string;
  sessionId: string;
  documentId: string;
  key: string;
  value: string;
  dataType: string;
  source: 'extracted' | 'manual' | 'validated';
  createdAt: string;
}

// API Response types
export interface ApiResponse<T> {
  data?: T;
  message?: string;
  error?: string;
}

export interface LoginResponse {
  user: User;
  token: string;
}

export interface UploadResponse {
  document: Document;
  message: string;
}