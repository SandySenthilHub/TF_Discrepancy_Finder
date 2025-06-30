import express from 'express';
import { authenticateToken } from '../middleware/auth.js';
import { processDocument, reprocessDocument, recognizeDocumentType} from '../services/ocrService.js';
import { DocumentModel } from '../models/Document.js';

const router = express.Router();

// Process document with OCR
router.post('/process/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    console.log(`OCR processing requested for document: ${documentId}`);
    
    // Update document status to processing
    await DocumentModel.updateDocumentStatus(documentId, 'processing');
    
    // Process document with OCR
    const result = await processDocument(documentId);
    
    // Update document status to processed
    await DocumentModel.updateDocumentStatus(documentId, 'processed');
    
    res.json({
      success: true,
      message: 'OCR processing completed successfully',
      data: {
        documentId: documentId,
        extractedText: result.extractedText,
        documentType: result.documentType,
        extractedFields: result.extractedFields,
        structuredData: result.structuredData,
        confidence: result.confidence,
        processedAt: new Date().toISOString()
      }
    });
  } catch (error) {
    console.error('OCR processing error:', error);
    await DocumentModel.updateDocumentStatus(req.params.documentId, 'error');
    res.status(500).json({ 
      success: false,
      error: 'OCR processing failed',
      details: error.message 
    });
  }
});

// Reprocess document with OCR (for iterations)
router.post('/reprocess/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    console.log(`OCR reprocessing requested for document: ${documentId}`);
    
    // Update document status to processing
    await DocumentModel.updateDocumentStatus(documentId, 'processing');
    
    // Reprocess the document
    const result = await reprocessDocument(documentId);
    
    // Update document status to processed
    await DocumentModel.updateDocumentStatus(documentId, 'processed');
    
    res.json({
      success: true,
      message: 'OCR reprocessing completed successfully',
      data: result
    });
  } catch (error) {
    console.error('OCR reprocessing error:', error);
    await DocumentModel.updateDocumentStatus(req.params.documentId, 'error');
    res.status(500).json({ 
      success: false,
      error: 'OCR reprocessing failed',
      details: error.message 
    });
  }
});

// Recognize document type
router.post('/recognize/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    // Get document file path
    const documents = await DocumentModel.getDocumentsBySession('temp'); // This needs proper implementation
    const document = documents.find(d => d.id === documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const recognition = await recognizeDocumentType(document.filePath);
    
    res.json({
      success: true,
      documentId: documentId,
      recognition: recognition
    });
  } catch (error) {
    console.error('Document recognition error:', error);
    res.status(500).json({ 
      success: false,
      error: 'Document recognition failed',
      details: error.message 
    });
  }
});

// Get OCR status for a document
router.get('/status/:documentId', authenticateToken, async (req, res) => {
  try {
    const documentId = req.params.documentId;
    
    // Get document status from database
    const documents = await DocumentModel.getDocumentsBySession('temp'); // This needs proper implementation
    const document = documents.find(d => d.id === documentId);
    
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    res.json({
      documentId: documentId,
      status: document.status,
      uploadedAt: document.uploadedAt,
      fileName: document.fileName,
      fileType: document.fileType
    });
  } catch (error) {
    console.error('Error fetching OCR status:', error);
    res.status(500).json({ error: 'Failed to fetch OCR status' });
  }
});

export default router;