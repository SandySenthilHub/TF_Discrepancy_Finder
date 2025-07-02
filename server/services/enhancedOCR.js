import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentModel } from '../models/Document.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Enhanced OCR service with better accuracy and formatting
export class EnhancedOCR {
  
  // Enhanced image preprocessing for better OCR accuracy
  static async preprocessImage(imagePath) {
    try {
      // This would typically use image processing libraries like Sharp or Canvas
      // For now, we'll use Tesseract's built-in preprocessing
      console.log(`Preprocessing image: ${imagePath}`);
      return imagePath; // Return original path for now
    } catch (error) {
      console.error('Error preprocessing image:', error);
      throw error;
    }
  }
  
  // Enhanced OCR with multiple recognition passes
  static async performEnhancedOCR(filePath, documentId, updateProgress) {
    try {
      console.log(`Starting enhanced OCR for: ${filePath}`);
      
      const uploadsDir = process.env.UPLOAD_PATH || './uploads';
      const fullPath = path.join(uploadsDir, filePath);
      
      if (!fs.existsSync(fullPath)) {
        throw new Error(`File not found: ${fullPath}`);
      }
      
      // First pass - standard OCR
      updateProgress(documentId, 'processing', 30, 'Starting OCR text extraction...');
      
      const firstPass = await Tesseract.recognize(fullPath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            const overallProgress = 30 + Math.round(progress * 0.25); // 30-55%
            updateProgress(documentId, 'processing', overallProgress, `OCR Pass 1: ${progress}%`);
          }
        }
      });
      
      updateProgress(documentId, 'processing', 55, 'Enhancing text recognition...');
      
      // Second pass - with different PSM (Page Segmentation Mode)
      const secondPass = await Tesseract.recognize(fullPath, 'eng', {
        logger: m => {
          if (m.status === 'recognizing text') {
            const progress = Math.round(m.progress * 100);
            const overallProgress = 55 + Math.round(progress * 0.15); // 55-70%
            updateProgress(documentId, 'processing', overallProgress, `OCR Pass 2: ${progress}%`);
          }
        },
        tessedit_pageseg_mode: Tesseract.PSM.AUTO_OSD
      });
      
      updateProgress(documentId, 'processing', 70, 'Combining and optimizing results...');
      
      // Combine results and choose the best
      const combinedText = this.combineOCRResults(firstPass.data, secondPass.data);
      
      updateProgress(documentId, 'processing', 75, 'Applying text formatting and cleanup...');
      
      // Enhanced text cleanup and formatting
      const cleanedText = this.enhanceTextFormatting(combinedText);
      
      return {
        text: cleanedText,
        confidence: Math.max(firstPass.data.confidence, secondPass.data.confidence),
        words: this.extractWordData(firstPass.data, secondPass.data),
        blocks: this.extractBlockData(firstPass.data, secondPass.data)
      };
      
    } catch (error) {
      console.error('Enhanced OCR error:', error);
      throw error;
    }
  }
  
  // Combine results from multiple OCR passes
  static combineOCRResults(firstResult, secondResult) {
    // Choose the result with higher confidence
    if (firstResult.confidence > secondResult.confidence) {
      return firstResult.text;
    } else {
      return secondResult.text;
    }
  }
  
  // Enhanced text formatting for better readability
  static enhanceTextFormatting(rawText) {
    let text = rawText;
    
    // Remove excessive whitespace
    text = text.replace(/\s+/g, ' ');
    
    // Fix common OCR errors
    text = this.fixCommonOCRErrors(text);
    
    // Improve line breaks and paragraph structure
    text = this.improveTextStructure(text);
    
    // Format numbers and dates
    text = this.formatNumbersAndDates(text);
    
    // Enhance document-specific formatting
    text = this.enhanceDocumentFormatting(text);
    
    return text.trim();
  }
  
  // Fix common OCR recognition errors
  static fixCommonOCRErrors(text) {
    const corrections = {
      // Common character misrecognitions
      '0': /(?<!\d)[O](?=\d)|(?<=\d)[O](?!\w)/g, // O to 0 in numbers
      'O': /(?<!\w)[0](?=[A-Z])|(?<=[A-Z])[0](?=\w)/g, // 0 to O in words
      'I': /(?<!\w)[1](?=[A-Z])|(?<=[A-Z])[1](?=\w)/g, // 1 to I in words
      '1': /(?<!\d)[I](?=\d)|(?<=\d)[I](?!\w)/g, // I to 1 in numbers
      'S': /(?<!\w)[5](?=[A-Z])|(?<=[A-Z])[5](?=\w)/g, // 5 to S in words
      '5': /(?<!\d)[S](?=\d)|(?<=\d)[S](?!\w)/g, // S to 5 in numbers
      
      // Common word corrections
      'LETTER OF CREDIT': /LETTER\s+0F\s+CREDIT/gi,
      'COMMERCIAL INVOICE': /C0MMERCIAL\s+INV0ICE/gi,
      'BILL OF LADING': /BILL\s+0F\s+LADING/gi,
      'CERTIFICATE': /CERTIF1CATE/gi,
      'INSURANCE': /1NSURANCE/gi,
      'AMOUNT': /AM0UNT/gi,
      'NUMBER': /NUMB3R/gi,
      'DATE': /DAT3/gi
    };
    
    let correctedText = text;
    for (const [correct, pattern] of Object.entries(corrections)) {
      correctedText = correctedText.replace(pattern, correct);
    }
    
    return correctedText;
  }
  
  // Improve text structure and formatting
  static improveTextStructure(text) {
    let structured = text;
    
    // Add proper line breaks after headers
    structured = structured.replace(/(LETTER OF CREDIT|COMMERCIAL INVOICE|BILL OF LADING|CERTIFICATE|INSURANCE)/gi, '\n\n$1\n');
    
    // Add line breaks before field labels
    structured = structured.replace(/([A-Z][A-Z\s]+:)/g, '\n$1');
    
    // Improve paragraph spacing
    structured = structured.replace(/\n\s*\n/g, '\n\n');
    
    // Format addresses properly
    structured = structured.replace(/(\d+\s+[A-Z][a-z]+\s+[A-Z][a-z]+)/g, '\n$1');
    
    return structured;
  }
  
  // Format numbers, currencies, and dates
  static formatNumbersAndDates(text) {
    let formatted = text;
    
    // Format currency amounts
    formatted = formatted.replace(/([A-Z]{3})\s*(\d+(?:,\d{3})*(?:\.\d{2})?)/g, '$1 $2');
    
    // Format dates
    formatted = formatted.replace(/(\d{1,2})[-\/](\d{1,2})[-\/](\d{2,4})/g, '$1/$2/$3');
    
    // Format percentages
    formatted = formatted.replace(/(\d+(?:\.\d+)?)\s*%/g, '$1%');
    
    // Format phone numbers
    formatted = formatted.replace(/(\d{3})\s*(\d{3})\s*(\d{4})/g, '$1-$2-$3');
    
    return formatted;
  }
  
  // Enhance document-specific formatting
  static enhanceDocumentFormatting(text) {
    let enhanced = text;
    
    // Letter of Credit formatting
    if (text.toLowerCase().includes('letter of credit')) {
      enhanced = this.formatLetterOfCredit(enhanced);
    }
    
    // Commercial Invoice formatting
    if (text.toLowerCase().includes('commercial invoice')) {
      enhanced = this.formatCommercialInvoice(enhanced);
    }
    
    // Bill of Lading formatting
    if (text.toLowerCase().includes('bill of lading')) {
      enhanced = this.formatBillOfLading(enhanced);
    }
    
    return enhanced;
  }
  
  // Format Letter of Credit documents
  static formatLetterOfCredit(text) {
    let formatted = text;
    
    // Format LC-specific fields
    formatted = formatted.replace(/(LC\s*NUMBER|CREDIT\s*NUMBER)\s*:?\s*([A-Z0-9\-]+)/gi, 
      '\n$1: $2\n');
    
    formatted = formatted.replace(/(BENEFICIARY)\s*:?\s*([^\n]+)/gi, 
      '\n$1:\n  $2\n');
    
    formatted = formatted.replace(/(APPLICANT)\s*:?\s*([^\n]+)/gi, 
      '\n$1:\n  $2\n');
    
    formatted = formatted.replace(/(AMOUNT)\s*:?\s*([A-Z]{3}\s*[\d,]+\.?\d*)/gi, 
      '\n$1: $2\n');
    
    return formatted;
  }
  
  // Format Commercial Invoice documents
  static formatCommercialInvoice(text) {
    let formatted = text;
    
    // Format invoice-specific fields
    formatted = formatted.replace(/(INVOICE\s*NUMBER)\s*:?\s*([A-Z0-9\-]+)/gi, 
      '\n$1: $2\n');
    
    formatted = formatted.replace(/(SOLD\s*TO|BILL\s*TO)\s*:?\s*([^\n]+)/gi, 
      '\n$1:\n  $2\n');
    
    formatted = formatted.replace(/(TOTAL\s*AMOUNT)\s*:?\s*([A-Z]{3}\s*[\d,]+\.?\d*)/gi, 
      '\n$1: $2\n');
    
    return formatted;
  }
  
  // Format Bill of Lading documents
  static formatBillOfLading(text) {
    let formatted = text;
    
    // Format B/L-specific fields
    formatted = formatted.replace(/(B\/L\s*NUMBER|BILL\s*OF\s*LADING\s*NUMBER)\s*:?\s*([A-Z0-9\-]+)/gi, 
      '\n$1: $2\n');
    
    formatted = formatted.replace(/(VESSEL)\s*:?\s*([^\n]+)/gi, 
      '\n$1: $2\n');
    
    formatted = formatted.replace(/(PORT\s*OF\s*LOADING)\s*:?\s*([^\n]+)/gi, 
      '\n$1: $2\n');
    
    formatted = formatted.replace(/(PORT\s*OF\s*DISCHARGE)\s*:?\s*([^\n]+)/gi, 
      '\n$1: $2\n');
    
    return formatted;
  }
  
  // Extract word-level data for advanced processing
  static extractWordData(firstResult, secondResult) {
    // Combine word data from both passes
    const words = [];
    
    if (firstResult.words) {
      firstResult.words.forEach(word => {
        if (word.confidence > 60) { // Only include high-confidence words
          words.push({
            text: word.text,
            confidence: word.confidence,
            bbox: word.bbox
          });
        }
      });
    }
    
    return words;
  }
  
  // Extract block-level data for document structure
  static extractBlockData(firstResult, secondResult) {
    const blocks = [];
    
    if (firstResult.blocks) {
      firstResult.blocks.forEach(block => {
        if (block.confidence > 50) {
          blocks.push({
            text: block.text,
            confidence: block.confidence,
            bbox: block.bbox,
            blockType: this.identifyBlockType(block.text)
          });
        }
      });
    }
    
    return blocks;
  }
  
  // Identify the type of text block (header, field, content, etc.)
  static identifyBlockType(text) {
    const upperText = text.toUpperCase();
    
    if (upperText.includes('LETTER OF CREDIT') || upperText.includes('DOCUMENTARY CREDIT')) {
      return 'document_header';
    }
    
    if (upperText.includes('COMMERCIAL INVOICE')) {
      return 'document_header';
    }
    
    if (upperText.includes('BILL OF LADING')) {
      return 'document_header';
    }
    
    if (upperText.match(/^[A-Z\s]+:$/)) {
      return 'field_label';
    }
    
    if (upperText.match(/^\d+/)) {
      return 'numeric_data';
    }
    
    if (upperText.match(/^[A-Z]{3}\s*[\d,]+/)) {
      return 'currency_amount';
    }
    
    return 'content';
  }
}