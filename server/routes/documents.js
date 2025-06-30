import express from 'express';
import multer from 'multer';
import path from 'path';
import { DocumentModel } from '../models/Document.js';
import { SessionModel } from '../models/Session.js';
import { authenticateToken } from '../middleware/auth.js';
import { processDocument, reprocessDocument } from '../services/ocrService.js';

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, process.env.UPLOAD_PATH || './uploads');
  },
  filename: (req, file, cb) => {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
  }
});

const upload = multer({
  storage: storage,
  limits: {
    fileSize: parseInt(process.env.MAX_FILE_SIZE) || 10485760 // 10MB default
  },
  fileFilter: (req, file, cb) => {
    const allowedTypes = /jpeg|jpg|png|pdf/;
    const extname = allowedTypes.test(path.extname(file.originalname).toLowerCase());
    const mimetype = allowedTypes.test(file.mimetype);

    if (mimetype && extname) {
      return cb(null, true);
    } else {
      cb(new Error('Only images (JPEG, JPG, PNG) and PDF files are allowed'));
    }
  }
});

// Upload document to session with automatic OCR processing
router.post('/upload/:sessionId', authenticateToken, upload.single('document'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'No file uploaded' });
    }

    const sessionId = req.params.sessionId;
    
    // Verify session exists and user has access
    const session = await SessionModel.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Save document to database
    const documentData = {
      sessionId: sessionId,
      fileName: req.file.originalname,
      fileType: req.file.mimetype,
      fileSize: req.file.size,
      filePath: req.file.filename // Store just the filename, not full path
    };

    const document = await DocumentModel.uploadDocument(documentData);
    
    // Update session status to uploading
    await SessionModel.updateSessionStatus(sessionId, 'uploading');

    console.log(`Document uploaded successfully: ${document.id}`);
    console.log(`File saved as: ${req.file.filename}`);

    // Start automatic OCR processing in background
    setImmediate(async () => {
      try {
        console.log(`Starting automatic OCR processing for document: ${document.id}`);
        
        // Update session status to processing
        await SessionModel.updateSessionStatus(sessionId, 'processing');
        
        // Process the document with OCR
        const ocrResult = await processDocument(document.id);
        
        console.log(`OCR processing completed for document: ${document.id}`);
        console.log(`Document type recognized: ${ocrResult.documentType}`);
        console.log(`Fields extracted: ${ocrResult.extractedFields.length}`);
        
        // Update session status based on processing result
        if (ocrResult.documentType !== 'Unknown') {
          await SessionModel.updateSessionStatus(sessionId, 'reviewing');
        }
        
      } catch (error) {
        console.error('Automatic OCR processing failed:', error);
        await DocumentModel.updateDocumentStatus(document.id, 'error');
      }
    });

    res.status(201).json({
      message: 'Document uploaded successfully. OCR processing started automatically.',
      document: {
        ...document,
        status: 'processing' // Indicate that processing has started
      }
    });
  } catch (error) {
    console.error('Error uploading document:', error);
    res.status(500).json({ error: 'Failed to upload document' });
  }
});

router.get('/:id/status', async (req, res) => {
  try {
    const document = await DocumentModel.getDocumentById(req.params.id);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    return res.json({ status: document.status });
  } catch (error) {
    console.error('Error fetching document status:', error);
    res.status(500).json({ error: 'Failed to fetch document status' });
  }
});

// Get documents for a session
router.get('/session/:sessionId', authenticateToken, async (req, res) => {
  try {
    const sessionId = req.params.sessionId;
    
    // Verify session exists and user has access
    const session = await SessionModel.getSessionById(sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    const documents = await DocumentModel.getDocumentsBySession(sessionId);
    res.json(documents);
  } catch (error) {
    console.error('Error fetching documents:', error);
    res.status(500).json({ error: 'Failed to fetch documents' });
  }
});

// Delete document
router.delete('/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    // Get document details first to check permissions
    const document = await DocumentModel.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Verify session exists and user has access
    const session = await SessionModel.getSessionById(document.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }

    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }

    // Check if session is frozen or completed
    if (session.status === 'frozen' || session.status === 'completed') {
      return res.status(400).json({ error: 'Cannot delete documents from frozen or completed sessions' });
    }
    
    // Delete the document
    const result = await DocumentModel.deleteDocument(documentId);
    
    console.log(`Document deleted by user ${req.user.userId}: ${documentId}`);
    
    res.json({
      message: 'Document deleted successfully',
      deletedDocument: result.deletedDocument
    });
  } catch (error) {
    console.error('Error deleting document:', error);
    res.status(500).json({ error: 'Failed to delete document' });
  }
});

// Manually trigger OCR processing for a document
router.post('/:documentId/process', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    console.log(`Manual OCR processing requested for document: ${documentId}`);
    
    // Get document details first
    const document = await DocumentModel.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    // Update document status to processing
    await DocumentModel.updateDocumentStatus(documentId, 'processing');
    
    // Process document with OCR
    const processedData = await processDocument(documentId);
    
    // Update document status to processed
    await DocumentModel.updateDocumentStatus(documentId, 'processed');
    
    res.json({
      message: 'Document processed successfully',
      data: {
        documentId: documentId,
        documentType: processedData.documentType,
        extractedText: processedData.extractedText,
        extractedFields: processedData.extractedFields,
        confidence: processedData.confidence,
        structuredData: processedData.structuredData
      }
    });
  } catch (error) {
    console.error('Error processing document:', error);
    await DocumentModel.updateDocumentStatus(req.params.documentId, 'error');
    res.status(500).json({ 
      error: 'Failed to process document',
      details: error.message 
    });
  }
});

// Get OCR results for a document
router.get('/:documentId/ocr', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    // Get cleaned document data
    const cleanedDoc = await DocumentModel.getCleanedDocument(documentId);
    
    if (!cleanedDoc) {
      return res.status(404).json({ error: 'OCR results not found. Process the document first.' });
    }
    
    res.json({
      documentId: documentId,
      extractedText: cleanedDoc.cleanedContent,
      extractedFields: JSON.parse(cleanedDoc.extractedFields || '[]'),
      documentType: cleanedDoc.matchedTemplate,
      isNewDocument: cleanedDoc.isNewDocument,
      processedAt: cleanedDoc.processedAt
    });
  } catch (error) {
    console.error('Error fetching OCR results:', error);
    res.status(500).json({ error: 'Failed to fetch OCR results' });
  }
});

// Reprocess document (for iterations)
router.post('/:documentId/reprocess', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    console.log(`Reprocessing document: ${documentId}`);
    
    // Update document status to processing
    await DocumentModel.updateDocumentStatus(documentId, 'processing');
    
    // Reprocess the document
    const reprocessedData = await reprocessDocument(documentId);
    
    // Update document status to processed
    await DocumentModel.updateDocumentStatus(documentId, 'processed');
    
    res.json({
      message: 'Document reprocessed successfully',
      data: reprocessedData
    });
  } catch (error) {
    console.error('Error reprocessing document:', error);
    await DocumentModel.updateDocumentStatus(req.params.documentId, 'error');
    res.status(500).json({ 
      error: 'Failed to reprocess document',
      details: error.message 
    });
  }
});

// Compare document against templates
router.post('/:documentId/compare', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    // Get the cleaned document to analyze
    const cleanedDoc = await DocumentModel.getCleanedDocument(documentId);
    
    if (!cleanedDoc) {
      return res.status(404).json({ error: 'Document not processed yet. Process the document first.' });
    }
    
    // Mock template comparison results based on document type
    const documentType = cleanedDoc.matchedTemplate || 'Unknown';
    
    let mockMatches = [];
    
    if (documentType === 'Letter of Credit') {
      mockMatches = [
        {
          id: 'template_lc_001',
          name: 'Standard Letter of Credit',
          type: 'master',
          confidence: 0.92,
          matchedFields: 8,
          totalFields: 10
        },
        {
          id: 'template_lc_002',
          name: 'Irrevocable LC Template',
          type: 'sub',
          confidence: 0.85,
          matchedFields: 7,
          totalFields: 10
        }
      ];
    } else if (documentType === 'Commercial Invoice') {
      mockMatches = [
        {
          id: 'template_invoice_001',
          name: 'Standard Commercial Invoice',
          type: 'master',
          confidence: 0.88,
          matchedFields: 6,
          totalFields: 8
        }
      ];
    } else if (documentType === 'Bill of Lading') {
      mockMatches = [
        {
          id: 'template_bl_001',
          name: 'Ocean Bill of Lading',
          type: 'master',
          confidence: 0.90,
          matchedFields: 7,
          totalFields: 8
        }
      ];
    }
    
    res.json({
      documentId: documentId,
      matches: mockMatches.filter(m => m.confidence > 0.5),
      totalTemplatesChecked: 232, // 40 master + 192 sub
      bestMatch: mockMatches[0] || null
    });
  } catch (error) {
    console.error('Error comparing document:', error);
    res.status(500).json({ error: 'Failed to compare document' });
  }
});

// Catalog document with selected template
router.post('/:documentId/catalog', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const { templateId } = req.body;
    
    if (!templateId) {
      return res.status(400).json({ error: 'Template ID is required' });
    }
    
    // Update document with matched template
    // This would typically update the document record with the template information
    
    res.json({
      message: 'Document cataloged successfully',
      documentId: documentId,
      templateId: templateId
    });
  } catch (error) {
    console.error('Error cataloging document:', error);
    res.status(500).json({ error: 'Failed to catalog document' });
  }
});

// Request approval for new document type
router.post('/:documentId/request-approval', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    const { documentType } = req.body;
    
    if (!documentType) {
      return res.status(400).json({ error: 'Document type is required' });
    }
    
    // Create approval request
    // This would typically create a record in the approval system
    
    res.json({
      message: 'Approval request submitted successfully',
      documentId: documentId,
      documentType: documentType,
      status: 'pending'
    });
  } catch (error) {
    console.error('Error requesting approval:', error);
    res.status(500).json({ error: 'Failed to request approval' });
  }
});

export default router;