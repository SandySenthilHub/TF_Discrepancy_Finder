import express from 'express';
import path from 'path';
import fs from 'fs';
import { authenticateToken } from '../middleware/auth.js';
import { DocumentModel } from '../models/Document.js';
import { SessionModel } from '../models/Session.js';
import { DocumentDownloader } from '../services/documentDownloader.js';

const router = express.Router();

// Download split document as PDF
router.get('/split-pdf/:documentId/:splitIndex', authenticateToken, async (req, res) => {
  try {
    const { documentId, splitIndex } = req.params;
    
    // Verify document access
    const document = await DocumentModel.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const session = await SessionModel.getSessionById(document.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Generate PDF
    const pdfInfo = await DocumentDownloader.generateSplitPDF(documentId, parseInt(splitIndex));
    const filePath = path.join(process.env.UPLOAD_PATH || './uploads', pdfInfo.filePath);
    
    // Set headers for download
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${pdfInfo.fileName}"`);
    res.setHeader('Content-Length', pdfInfo.size);
    
    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Clean up file after download
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Error cleaning up PDF file:', error);
        }
      }, 5000); // Delete after 5 seconds
    });
    
  } catch (error) {
    console.error('Error downloading split PDF:', error);
    res.status(500).json({ error: 'Failed to generate PDF download' });
  }
});

// Download split document as formatted text
router.get('/split-text/:documentId/:splitIndex', authenticateToken, async (req, res) => {
  try {
    const { documentId, splitIndex } = req.params;
    const format = req.query.format || 'txt'; // txt, json, markdown
    
    // Verify document access
    const document = await DocumentModel.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const session = await SessionModel.getSessionById(document.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Generate formatted text
    const textInfo = await DocumentDownloader.generateFormattedText(documentId, parseInt(splitIndex), format);
    const filePath = path.join(process.env.UPLOAD_PATH || './uploads', textInfo.filePath);
    
    // Set headers for download
    const mimeTypes = {
      txt: 'text/plain',
      json: 'application/json',
      markdown: 'text/markdown'
    };
    
    res.setHeader('Content-Type', mimeTypes[format] || 'text/plain');
    res.setHeader('Content-Disposition', `attachment; filename="${textInfo.fileName}"`);
    res.setHeader('Content-Length', textInfo.size);
    
    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Clean up file after download
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Error cleaning up text file:', error);
        }
      }, 5000);
    });
    
  } catch (error) {
    console.error('Error downloading split text:', error);
    res.status(500).json({ error: 'Failed to generate text download' });
  }
});

// Download all split documents as a package
router.get('/package/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Verify document access
    const document = await DocumentModel.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const session = await SessionModel.getSessionById(document.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Generate package
    const packageInfo = await DocumentDownloader.generateCombinedPackage(documentId);
    
    res.json({
      message: 'Package generated successfully',
      packageId: packageInfo.packageId,
      manifest: packageInfo.manifest,
      documents: packageInfo.documents,
      totalFiles: packageInfo.totalFiles,
      downloadLinks: {
        manifest: `/api/downloads/file/${packageInfo.manifest}`,
        documents: packageInfo.documents.map(doc => ({
          splitIndex: doc.splitIndex,
          documentType: doc.documentType,
          textFile: `/api/downloads/file/${doc.files.text}`,
          jsonFile: `/api/downloads/file/${doc.files.json}`
        }))
      }
    });
    
  } catch (error) {
    console.error('Error generating package:', error);
    res.status(500).json({ error: 'Failed to generate package' });
  }
});

// Download individual file from package
router.get('/file/:fileName', authenticateToken, async (req, res) => {
  try {
    const { fileName } = req.params;
    const filePath = path.join(process.env.UPLOAD_PATH || './uploads', fileName);
    
    // Security check - ensure file exists and is in uploads directory
    if (!fs.existsSync(filePath) || !filePath.startsWith(path.resolve(process.env.UPLOAD_PATH || './uploads'))) {
      return res.status(404).json({ error: 'File not found' });
    }
    
    // Get file stats
    const stats = fs.statSync(filePath);
    const fileExtension = path.extname(fileName).toLowerCase();
    
    // Set appropriate content type
    const mimeTypes = {
      '.txt': 'text/plain',
      '.json': 'application/json',
      '.md': 'text/markdown',
      '.pdf': 'application/pdf'
    };
    
    const contentType = mimeTypes[fileExtension] || 'application/octet-stream';
    
    res.setHeader('Content-Type', contentType);
    res.setHeader('Content-Disposition', `attachment; filename="${fileName}"`);
    res.setHeader('Content-Length', stats.size);
    
    // Stream file
    const fileStream = fs.createReadStream(filePath);
    fileStream.pipe(res);
    
    // Clean up file after download
    fileStream.on('end', () => {
      setTimeout(() => {
        try {
          fs.unlinkSync(filePath);
        } catch (error) {
          console.error('Error cleaning up file:', error);
        }
      }, 10000); // Delete after 10 seconds
    });
    
  } catch (error) {
    console.error('Error downloading file:', error);
    res.status(500).json({ error: 'Failed to download file' });
  }
});

// Get download options for a document
router.get('/options/:documentId', authenticateToken, async (req, res) => {
  try {
    const { documentId } = req.params;
    
    // Verify document access
    const document = await DocumentModel.getDocumentById(documentId);
    if (!document) {
      return res.status(404).json({ error: 'Document not found' });
    }
    
    const session = await SessionModel.getSessionById(document.sessionId);
    if (!session) {
      return res.status(404).json({ error: 'Session not found' });
    }
    
    if (req.user.role !== 'admin' && session.userId !== req.user.userId) {
      return res.status(403).json({ error: 'Access denied' });
    }
    
    // Get split documents info
    const cleanedDoc = await DocumentModel.getCleanedDocument(documentId);
    let splitDocuments = [];
    
    if (cleanedDoc && cleanedDoc.cleanedContent) {
      try {
        if (cleanedDoc.cleanedContent.startsWith('[')) {
          splitDocuments = JSON.parse(cleanedDoc.cleanedContent);
        }
      } catch (parseError) {
        console.log('No split documents found');
      }
    }
    
    const downloadOptions = {
      documentId: documentId,
      fileName: document.fileName,
      hasSplitDocuments: splitDocuments.length > 1,
      splitCount: splitDocuments.length,
      availableFormats: {
        pdf: 'Formatted PDF document',
        txt: 'Plain text with enhanced formatting',
        json: 'Structured JSON with metadata',
        markdown: 'Markdown format for documentation'
      },
      splitDocuments: splitDocuments.map(split => ({
        splitIndex: split.splitIndex,
        documentType: split.documentType,
        confidence: split.confidence,
        fieldCount: split.extractedFields?.length || 0,
        wordCount: split.metadata?.wordCount || 0,
        downloadLinks: {
          pdf: `/api/downloads/split-pdf/${documentId}/${split.splitIndex}`,
          txt: `/api/downloads/split-text/${documentId}/${split.splitIndex}?format=txt`,
          json: `/api/downloads/split-text/${documentId}/${split.splitIndex}?format=json`,
          markdown: `/api/downloads/split-text/${documentId}/${split.splitIndex}?format=markdown`
        }
      })),
      packageDownload: splitDocuments.length > 1 ? `/api/downloads/package/${documentId}` : null
    };
    
    res.json(downloadOptions);
    
  } catch (error) {
    console.error('Error getting download options:', error);
    res.status(500).json({ error: 'Failed to get download options' });
  }
});

export default router;