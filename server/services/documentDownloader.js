import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { PDFDocument, rgb, StandardFonts } from 'pdf-lib';
import { DocumentModel } from '../models/Document.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export class DocumentDownloader {
  
  // Generate downloadable PDF for a split document
  static async generateSplitPDF(documentId, splitIndex) {
    try {
      console.log(`Generating PDF for split document: ${documentId}_split_${splitIndex}`);
      
      // Get the cleaned document data
      const cleanedDoc = await DocumentModel.getCleanedDocument(documentId);
      if (!cleanedDoc) {
        throw new Error('Document not found or not processed');
      }
      
      // Parse split documents
      let splitDocuments = [];
      try {
        if (cleanedDoc.cleanedContent && cleanedDoc.cleanedContent.startsWith('[')) {
          splitDocuments = JSON.parse(cleanedDoc.cleanedContent);
        }
      } catch (parseError) {
        throw new Error('No split documents found');
      }
      
      const splitDoc = splitDocuments.find(doc => doc.splitIndex === splitIndex);
      if (!splitDoc) {
        throw new Error(`Split document ${splitIndex} not found`);
      }
      
      // Create new PDF document
      const pdfDoc = await PDFDocument.create();
      const font = await pdfDoc.embedFont(StandardFonts.Helvetica);
      const boldFont = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
      
      // Add pages and content
      const page = pdfDoc.addPage([612, 792]); // Letter size
      const { width, height } = page.getSize();
      
      let yPosition = height - 50;
      const margin = 50;
      const lineHeight = 14;
      const maxWidth = width - (margin * 2);
      
      // Title
      page.drawText(splitDoc.documentType, {
        x: margin,
        y: yPosition,
        size: 18,
        font: boldFont,
        color: rgb(0, 0, 0.8)
      });
      yPosition -= 30;
      
      // Metadata
      page.drawText(`Confidence: ${Math.round(splitDoc.confidence * 100)}%`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      });
      yPosition -= 15;
      
      page.drawText(`Pages: ${splitDoc.pageRange.start}-${splitDoc.pageRange.end}`, {
        x: margin,
        y: yPosition,
        size: 10,
        font: font,
        color: rgb(0.5, 0.5, 0.5)
      });
      yPosition -= 25;
      
      // Content
      const contentLines = this.wrapText(splitDoc.content, maxWidth, font, 11);
      
      for (const line of contentLines) {
        if (yPosition < margin + 20) {
          // Add new page if needed
          const newPage = pdfDoc.addPage([612, 792]);
          yPosition = height - 50;
        }
        
        page.drawText(line, {
          x: margin,
          y: yPosition,
          size: 11,
          font: font,
          color: rgb(0, 0, 0)
        });
        yPosition -= lineHeight;
      }
      
      // Save PDF
      const pdfBytes = await pdfDoc.save();
      const fileName = `${splitDoc.documentType.replace(/\s+/g, '_')}_Split_${splitIndex}.pdf`;
      const filePath = path.join(process.env.UPLOAD_PATH || './uploads', fileName);
      
      fs.writeFileSync(filePath, pdfBytes);
      
      return {
        fileName: fileName,
        filePath: fileName,
        size: pdfBytes.length,
        documentType: splitDoc.documentType,
        splitIndex: splitIndex
      };
      
    } catch (error) {
      console.error('Error generating split PDF:', error);
      throw error;
    }
  }
  
  // Generate formatted text file for a split document
  static async generateFormattedText(documentId, splitIndex, format = 'txt') {
    try {
      console.log(`Generating formatted text for split document: ${documentId}_split_${splitIndex}`);
      
      // Get the cleaned document data
      const cleanedDoc = await DocumentModel.getCleanedDocument(documentId);
      if (!cleanedDoc) {
        throw new Error('Document not found or not processed');
      }
      
      // Parse split documents
      let splitDocuments = [];
      try {
        if (cleanedDoc.cleanedContent && cleanedDoc.cleanedContent.startsWith('[')) {
          splitDocuments = JSON.parse(cleanedDoc.cleanedContent);
        }
      } catch (parseError) {
        throw new Error('No split documents found');
      }
      
      const splitDoc = splitDocuments.find(doc => doc.splitIndex === splitIndex);
      if (!splitDoc) {
        throw new Error(`Split document ${splitIndex} not found`);
      }
      
      let formattedContent = '';
      
      if (format === 'json') {
        // JSON format with structured data
        const structuredData = {
          documentInfo: {
            type: splitDoc.documentType,
            confidence: splitDoc.confidence,
            pageRange: splitDoc.pageRange,
            metadata: splitDoc.metadata
          },
          extractedFields: splitDoc.extractedFields,
          structuredSections: splitDoc.structuredData?.sections || [],
          rawContent: splitDoc.content
        };
        formattedContent = JSON.stringify(structuredData, null, 2);
      } else if (format === 'markdown') {
        // Markdown format
        formattedContent = this.generateMarkdownFormat(splitDoc);
      } else {
        // Plain text format with enhanced readability
        formattedContent = this.generateReadableTextFormat(splitDoc);
      }
      
      const fileExtension = format === 'json' ? 'json' : format === 'markdown' ? 'md' : 'txt';
      const fileName = `${splitDoc.documentType.replace(/\s+/g, '_')}_Split_${splitIndex}.${fileExtension}`;
      const filePath = path.join(process.env.UPLOAD_PATH || './uploads', fileName);
      
      fs.writeFileSync(filePath, formattedContent, 'utf8');
      
      return {
        fileName: fileName,
        filePath: fileName,
        size: Buffer.byteLength(formattedContent, 'utf8'),
        documentType: splitDoc.documentType,
        splitIndex: splitIndex,
        format: format
      };
      
    } catch (error) {
      console.error('Error generating formatted text:', error);
      throw error;
    }
  }
  
  // Generate combined download package for all split documents
  static async generateCombinedPackage(documentId, format = 'zip') {
    try {
      console.log(`Generating combined package for document: ${documentId}`);
      
      // Get the cleaned document data
      const cleanedDoc = await DocumentModel.getCleanedDocument(documentId);
      if (!cleanedDoc) {
        throw new Error('Document not found or not processed');
      }
      
      // Parse split documents
      let splitDocuments = [];
      try {
        if (cleanedDoc.cleanedContent && cleanedDoc.cleanedContent.startsWith('[')) {
          splitDocuments = JSON.parse(cleanedDoc.cleanedContent);
        }
      } catch (parseError) {
        throw new Error('No split documents found');
      }
      
      const packageData = {
        documentId: documentId,
        totalSplits: splitDocuments.length,
        generatedAt: new Date().toISOString(),
        documents: []
      };
      
      // Generate files for each split
      for (const splitDoc of splitDocuments) {
        const textFile = await this.generateFormattedText(documentId, splitDoc.splitIndex, 'txt');
        const jsonFile = await this.generateFormattedText(documentId, splitDoc.splitIndex, 'json');
        
        packageData.documents.push({
          splitIndex: splitDoc.splitIndex,
          documentType: splitDoc.documentType,
          confidence: splitDoc.confidence,
          files: {
            text: textFile.fileName,
            json: jsonFile.fileName
          }
        });
      }
      
      // Create package manifest
      const manifestFileName = `package_manifest_${documentId}.json`;
      const manifestPath = path.join(process.env.UPLOAD_PATH || './uploads', manifestFileName);
      fs.writeFileSync(manifestPath, JSON.stringify(packageData, null, 2), 'utf8');
      
      return {
        packageId: `package_${documentId}`,
        manifest: manifestFileName,
        documents: packageData.documents,
        totalFiles: packageData.documents.length * 2 + 1 // text + json + manifest
      };
      
    } catch (error) {
      console.error('Error generating combined package:', error);
      throw error;
    }
  }
  
  // Helper method to wrap text for PDF generation
  static wrapText(text, maxWidth, font, fontSize) {
    const words = text.split(' ');
    const lines = [];
    let currentLine = '';
    
    for (const word of words) {
      const testLine = currentLine + (currentLine ? ' ' : '') + word;
      const textWidth = font.widthOfTextAtSize(testLine, fontSize);
      
      if (textWidth <= maxWidth) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }
    
    if (currentLine) {
      lines.push(currentLine);
    }
    
    return lines;
  }
  
  // Generate readable text format with enhanced formatting
  static generateReadableTextFormat(splitDoc) {
    let content = '';
    
    // Header
    content += '='.repeat(80) + '\n';
    content += `DOCUMENT TYPE: ${splitDoc.documentType.toUpperCase()}\n`;
    content += '='.repeat(80) + '\n\n';
    
    // Metadata
    content += 'DOCUMENT INFORMATION:\n';
    content += '-'.repeat(40) + '\n';
    content += `Confidence Level: ${Math.round(splitDoc.confidence * 100)}%\n`;
    content += `Page Range: ${splitDoc.pageRange.start} - ${splitDoc.pageRange.end}\n`;
    content += `Word Count: ${splitDoc.metadata.wordCount}\n`;
    content += `Character Count: ${splitDoc.metadata.characterCount}\n`;
    content += `Fields Extracted: ${splitDoc.extractedFields.length}\n\n`;
    
    // Extracted Fields Section
    if (splitDoc.extractedFields && splitDoc.extractedFields.length > 0) {
      content += 'EXTRACTED FIELDS:\n';
      content += '-'.repeat(40) + '\n';
      
      splitDoc.extractedFields.forEach((field, index) => {
        content += `${index + 1}. ${field.fieldName}:\n`;
        content += `   Value: ${field.fieldValue}\n`;
        content += `   Confidence: ${Math.round(field.confidence * 100)}%\n\n`;
      });
    }
    
    // Structured Sections (if available)
    if (splitDoc.structuredData && splitDoc.structuredData.sections) {
      content += 'STRUCTURED CONTENT:\n';
      content += '-'.repeat(40) + '\n';
      
      splitDoc.structuredData.sections.forEach((section, index) => {
        content += `\n[${section.name.toUpperCase()}]\n`;
        content += section.content.join('\n') + '\n';
      });
      content += '\n';
    }
    
    // Raw Content
    content += 'FULL DOCUMENT CONTENT:\n';
    content += '-'.repeat(40) + '\n';
    content += splitDoc.content + '\n\n';
    
    // Footer
    content += '='.repeat(80) + '\n';
    content += `Generated on: ${new Date().toLocaleString()}\n`;
    content += `Document ID: ${splitDoc.id}\n`;
    content += '='.repeat(80) + '\n';
    
    return content;
  }
  
  // Generate markdown format
  static generateMarkdownFormat(splitDoc) {
    let content = '';
    
    // Header
    content += `# ${splitDoc.documentType}\n\n`;
    
    // Metadata table
    content += '## Document Information\n\n';
    content += '| Property | Value |\n';
    content += '|----------|-------|\n';
    content += `| Confidence | ${Math.round(splitDoc.confidence * 100)}% |\n`;
    content += `| Page Range | ${splitDoc.pageRange.start} - ${splitDoc.pageRange.end} |\n`;
    content += `| Word Count | ${splitDoc.metadata.wordCount} |\n`;
    content += `| Fields Extracted | ${splitDoc.extractedFields.length} |\n\n`;
    
    // Extracted Fields
    if (splitDoc.extractedFields && splitDoc.extractedFields.length > 0) {
      content += '## Extracted Fields\n\n';
      
      splitDoc.extractedFields.forEach((field, index) => {
        content += `### ${field.fieldName}\n`;
        content += `**Value:** ${field.fieldValue}\n\n`;
        content += `**Confidence:** ${Math.round(field.confidence * 100)}%\n\n`;
      });
    }
    
    // Structured Content
    if (splitDoc.structuredData && splitDoc.structuredData.sections) {
      content += '## Structured Content\n\n';
      
      splitDoc.structuredData.sections.forEach((section) => {
        content += `### ${section.name}\n\n`;
        content += '```\n';
        content += section.content.join('\n');
        content += '\n```\n\n';
      });
    }
    
    // Raw Content
    content += '## Full Document Content\n\n';
    content += '```\n';
    content += splitDoc.content;
    content += '\n```\n\n';
    
    // Footer
    content += '---\n';
    content += `*Generated on: ${new Date().toLocaleString()}*\n`;
    content += `*Document ID: ${splitDoc.id}*\n`;
    
    return content;
  }
}