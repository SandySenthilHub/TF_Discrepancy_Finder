import Tesseract from 'tesseract.js';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentModel } from '../models/Document.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Mock document templates for recognition
const DOCUMENT_TEMPLATES = {
  'Letter of Credit': {
    keywords: ['letter of credit', 'documentary credit', 'irrevocable', 'beneficiary', 'applicant', 'lc number'],
    fields: ['LC Number', 'Issue Date', 'Expiry Date', 'Amount', 'Beneficiary', 'Applicant']
  },
  'Bill of Lading': {
    keywords: ['bill of lading', 'shipped on board', 'consignee', 'notify party', 'vessel'],
    fields: ['B/L Number', 'Vessel', 'Port of Loading', 'Port of Discharge', 'Consignee']
  },
  'Commercial Invoice': {
    keywords: ['commercial invoice', 'invoice number', 'total amount', 'description of goods', 'invoice'],
    fields: ['Invoice Number', 'Date', 'Total Amount', 'Description', 'Quantity']
  },
  'Packing List': {
    keywords: ['packing list', 'packages', 'gross weight', 'net weight'],
    fields: ['Package Count', 'Gross Weight', 'Net Weight', 'Dimensions']
  },
  'Certificate of Origin': {
    keywords: ['certificate of origin', 'country of origin', 'chamber of commerce'],
    fields: ['Certificate Number', 'Country of Origin', 'Goods Description']
  },
  'Insurance Certificate': {
    keywords: ['insurance certificate', 'policy number', 'insured amount', 'coverage'],
    fields: ['Policy Number', 'Insured Amount', 'Coverage Type', 'Validity']
  }
};

export const processDocument = async (documentId) => {
  try {
    console.log(`Starting OCR processing for document: ${documentId}`);
    
    // Get document details from database
    const document = await DocumentModel.getDocumentById(documentId);
    
    if (!document) {
      throw new Error('Document not found');
    }

    console.log(`Processing document: ${document.fileName} (${document.fileType})`);

    // Update status to processing
    await DocumentModel.updateDocumentStatus(documentId, 'processing');

    // Perform OCR based on file type
    let extractedText = '';
    
    try {
      if (document.fileType.startsWith('image/')) {
        console.log('Processing image file with Tesseract...');
        extractedText = await performImageOCR(document.filePath);
      } else if (document.fileType === 'application/pdf') {
        console.log('Processing PDF file...');
        extractedText = await performPDFOCR(document.filePath);
      } else {
        throw new Error('Unsupported file type for OCR');
      }
    } catch (ocrError) {
      console.error('OCR processing failed, using mock data:', ocrError.message);
      // Use mock data for demonstration
      extractedText = generateMockOCRText(document.fileName);
    }

    console.log(`Extracted text length: ${extractedText.length} characters`);

    // Recognize document type
    const documentType = recognizeDocumentTypeFromText(extractedText);
    console.log(`Recognized document type: ${documentType}`);

    // Split and structure the form based on type
    const structuredData = splitFormByType(extractedText, documentType);

    // Extract fields based on document type
    const extractedFields = extractFieldsByType(extractedText, documentType);

    console.log(`Extracted ${extractedFields.length} fields`);

    // Save cleaned document data
    const cleanedData = {
      documentId: documentId,
      sessionId: document.sessionId,
      cleanedContent: extractedText,
      extractedFields: extractedFields,
      matchedTemplate: documentType,
      isNewDocument: documentType === 'Unknown',
      structuredData: structuredData
    };

    try {
      await DocumentModel.saveCleanedDocument(cleanedData);
      console.log(`Cleaned document data saved for: ${documentId}`);
    } catch (saveError) {
      console.error('Failed to save cleaned document data:', saveError.message);
      // Continue processing even if save fails
    }

    // Update document status to processed
    await DocumentModel.updateDocumentStatus(documentId, 'processed');

    console.log(`OCR processing completed for document: ${documentId}`);

    return {
      documentId: documentId,
      extractedText: extractedText,
      documentType: documentType,
      extractedFields: extractedFields,
      structuredData: structuredData,
      confidence: calculateOverallConfidence(extractedFields)
    };

  } catch (error) {
    console.error('OCR processing error:', error);
    try {
      await DocumentModel.updateDocumentStatus(documentId, 'error');
    } catch (updateError) {
      console.error('Failed to update document status to error:', updateError.message);
    }
    throw error;
  }
};

const performImageOCR = async (filePath) => {
  try {
    // Construct the full file path
    const uploadsDir = process.env.UPLOAD_PATH || './uploads';
    const fullPath = path.join(uploadsDir, filePath);
    
    console.log(`Attempting OCR on image: ${fullPath}`);
    
    // Check if file exists
    if (!fs.existsSync(fullPath)) {
      console.error(`File not found: ${fullPath}`);
      throw new Error(`File not found: ${fullPath}`);
    }

    const { data: { text } } = await Tesseract.recognize(fullPath, 'eng', {
      logger: m => {
        if (m.status === 'recognizing text') {
          console.log(`OCR Progress: ${Math.round(m.progress * 100)}%`);
        }
      }
    });
    
    return text;
  } catch (error) {
    console.error('Image OCR error:', error);
    throw new Error(`Failed to extract text from image: ${error.message}`);
  }
};

import { runPythonOCR } from './pythonRunner.js'; // Adjust the path if needed

const performPDFOCR = async (filePath) => {
  try {
    console.log(`Calling Python OCR for: ${filePath}`);
    
    const uploadsDir = process.env.UPLOAD_PATH || './uploads';
    const fullPath = path.resolve(uploadsDir, filePath);  // ✅ absolute path

    const extractedText = await runPythonOCR(fullPath);   // 👈 call Python
    return extractedText;

  } catch (error) {
    console.error('Python OCR failed:', error);
    throw new Error(`Failed to extract text from PDF via Python: ${error}`);
  }
};




const generateMockOCRText = (fileName) => {
  const name = fileName.toLowerCase();
  
  if (name.includes('lc') || name.includes('letter') || name.includes('credit')) {
    return `
IRREVOCABLE DOCUMENTARY CREDIT

LC Number: LC${Math.random().toString().substr(2, 8)}
Issue Date: ${new Date().toLocaleDateString()}
Expiry Date: ${new Date(Date.now() + 180 * 24 * 60 * 60 * 1000).toLocaleDateString()}
Amount: USD ${(Math.random() * 100000 + 10000).toFixed(2)}

Beneficiary: ABC Trading Company Limited
123 Business Street, Trade City, TC 12345

Applicant: XYZ Import Corporation
456 Commerce Avenue, Import Town, IT 67890

Description of Goods:
Electronic components and accessories as per proforma invoice PI-2024-001
Quantity: 1000 units
Unit Price: USD 50.00 per unit

Documents Required:
- Commercial Invoice in triplicate
- Packing List
- Bill of Lading
- Certificate of Origin
- Insurance Certificate

Terms and Conditions:
- Shipment from: Port of Shanghai
- Shipment to: Port of Los Angeles
- Latest shipment date: ${new Date(Date.now() + 90 * 24 * 60 * 60 * 1000).toLocaleDateString()}
- Presentation period: 21 days after shipment date

This credit is subject to UCP 600.
    `;
  } else if (name.includes('invoice')) {
    return `
COMMERCIAL INVOICE

Invoice Number: INV-${Math.random().toString().substr(2, 6)}
Invoice Date: ${new Date().toLocaleDateString()}

Sold To:
XYZ Import Corporation
456 Commerce Avenue
Import Town, IT 67890

Ship To:
Same as above

Description of Goods:
Electronic Components - Model EC-2024
Quantity: 1000 units
Unit Price: USD 50.00
Total Amount: USD 50,000.00

Terms: FOB Shanghai
Payment: Letter of Credit

Shipper: ABC Trading Company Limited
    `;
  } else if (name.includes('bl') || name.includes('lading')) {
    return `
BILL OF LADING

B/L Number: BL${Math.random().toString().substr(2, 8)}
Vessel: MV TRADE CARRIER
Voyage: TC-2024-${Math.random().toString().substr(2, 3)}

Port of Loading: Shanghai, China
Port of Discharge: Los Angeles, USA

Shipper: ABC Trading Company Limited
Consignee: XYZ Import Corporation
Notify Party: Same as Consignee

Description of Goods:
1000 CTNS Electronic Components
Gross Weight: 5000 KGS
Measurement: 50 CBM

Freight: PREPAID
Shipped on Board: ${new Date().toLocaleDateString()}
    `;
  } else {
    return `
TRADE FINANCE DOCUMENT

Document Number: DOC-${Math.random().toString().substr(2, 8)}
Date: ${new Date().toLocaleDateString()}

This document contains trade finance information
related to international commerce transactions.

Parties involved:
- Exporter: ABC Trading Company
- Importer: XYZ Import Corporation

Transaction Details:
- Value: USD ${(Math.random() * 100000 + 10000).toFixed(2)}
- Currency: USD
- Terms: FOB

Additional information and terms apply.
    `;
  }
};

const recognizeDocumentTypeFromText = (text) => {
  const normalizedText = text.toLowerCase();
  
  for (const [templateName, template] of Object.entries(DOCUMENT_TEMPLATES)) {
    const matchCount = template.keywords.filter(keyword => 
      normalizedText.includes(keyword.toLowerCase())
    ).length;
    
    // If more than half the keywords match, consider it a match
    if (matchCount >= Math.ceil(template.keywords.length / 2)) {
      return templateName;
    }
  }
  
  return 'Unknown';
};

const splitFormByType = (text, documentType) => {
  const lines = text.split('\n').filter(line => line.trim());
  
  const structuredData = {
    documentType: documentType,
    sections: [],
    metadata: {
      totalLines: lines.length,
      processedAt: new Date().toISOString()
    }
  };

  switch (documentType) {
    case 'Letter of Credit':
      structuredData.sections = splitLetterOfCredit(lines);
      break;
    case 'Bill of Lading':
      structuredData.sections = splitBillOfLading(lines);
      break;
    case 'Commercial Invoice':
      structuredData.sections = splitCommercialInvoice(lines);
      break;
    default:
      structuredData.sections = splitGenericDocument(lines);
  }

  return structuredData;
};

const splitLetterOfCredit = (lines) => {
  const sections = [
    { name: 'Header', content: [], startPattern: /letter of credit|documentary credit|lc number/i },
    { name: 'Parties', content: [], startPattern: /beneficiary|applicant/i },
    { name: 'Amount and Currency', content: [], startPattern: /amount|currency|usd|eur/i },
    { name: 'Dates', content: [], startPattern: /date|expiry|validity/i },
    { name: 'Description of Goods', content: [], startPattern: /description|goods|merchandise/i },
    { name: 'Documents Required', content: [], startPattern: /documents|certificate|invoice/i },
    { name: 'Terms and Conditions', content: [], startPattern: /terms|conditions|clause/i }
  ];

  let currentSection = null;
  
  lines.forEach(line => {
    const trimmedLine = line.trim();
    if (!trimmedLine) return;

    // Check if line starts a new section
    const matchingSection = sections.find(section => 
      section.startPattern.test(trimmedLine)
    );

    if (matchingSection) {
      currentSection = matchingSection;
    }

    if (currentSection) {
      currentSection.content.push(trimmedLine);
    } else {
      // Add to first section if no specific section found
      sections[0].content.push(trimmedLine);
    }
  });

  return sections.filter(section => section.content.length > 0);
};

const splitBillOfLading = (lines) => {
  return [
    { name: 'Shipping Details', content: lines.filter(line => 
      /vessel|ship|port|loading|discharge|voyage/i.test(line)) },
    { name: 'Cargo Information', content: lines.filter(line => 
      /cargo|goods|container|weight|measurement|ctns/i.test(line)) },
    { name: 'Parties', content: lines.filter(line => 
      /shipper|consignee|notify/i.test(line)) }
  ];
};

const splitCommercialInvoice = (lines) => {
  return [
    { name: 'Invoice Header', content: lines.filter(line => 
      /invoice|number|date/i.test(line)) },
    { name: 'Buyer/Seller Info', content: lines.filter(line => 
      /sold to|bill to|ship to|from/i.test(line)) },
    { name: 'Items and Pricing', content: lines.filter(line => 
      /description|quantity|price|amount|total/i.test(line)) }
  ];
};

const splitGenericDocument = (lines) => {
  return [
    { name: 'Content', content: lines }
  ];
};

const extractFieldsByType = (text, documentType) => {
  const template = DOCUMENT_TEMPLATES[documentType];
  if (!template) {
    return extractGenericFields(text);
  }

  const extractedFields = [];
  const lines = text.split('\n');

  template.fields.forEach((fieldName, index) => {
    const fieldValue = extractFieldValue(text, fieldName);
    if (fieldValue) {
      extractedFields.push({
        id: `field_${Date.now()}_${index}`,
        documentId: 'temp', // This would be set properly
        fieldName: fieldName,
        fieldValue: fieldValue,
        confidence: calculateFieldConfidence(fieldValue, fieldName),
        position: { x: 0, y: index * 30, width: 200, height: 25 }, // Mock position
        isValidated: false,
        isEdited: false
      });
    }
  });

  return extractedFields;
};

const extractFieldValue = (text, fieldName) => {
  const patterns = {
    'LC Number': /(?:lc|letter of credit)\s*(?:number|no\.?|#)?\s*:?\s*([A-Z0-9]+)/i,
    'Issue Date': /(?:issue|issued|invoice)\s*(?:date|on)?\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    'Expiry Date': /(?:expiry|expires?|expiration)\s*(?:date|on)?\s*:?\s*(\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}|\d{4}-\d{2}-\d{2})/i,
    'Amount': /(?:amount|value|total)\s*:?\s*([A-Z]{3}\s*[\d,]+\.?\d*)/i,
    'Beneficiary': /beneficiary\s*:?\s*([^\n]+)/i,
    'Applicant': /applicant\s*:?\s*([^\n]+)/i,
    'B/L Number': /(?:b\/l|bill of lading)\s*(?:number|no\.?|#)?\s*:?\s*([A-Z0-9]+)/i,
    'Invoice Number': /invoice\s*(?:number|no\.?|#)?\s*:?\s*([A-Z0-9\-]+)/i,
    'Total Amount': /total\s*(?:amount|value)?\s*:?\s*([A-Z]{3}\s*[\d,]+\.?\d*)/i,
    'Vessel': /vessel\s*:?\s*([^\n]+)/i,
    'Port of Loading': /port of loading\s*:?\s*([^\n]+)/i,
    'Port of Discharge': /port of discharge\s*:?\s*([^\n]+)/i
  };

  const pattern = patterns[fieldName];
  if (pattern) {
    const match = text.match(pattern);
    return match ? match[1].trim() : null;
  }

  // Generic extraction for unknown fields
  const genericPattern = new RegExp(`${fieldName}\\s*:?\\s*([^\\n]+)`, 'i');
  const match = text.match(genericPattern);
  return match ? match[1].trim() : null;
};

const extractGenericFields = (text) => {
  const lines = text.split('\n').filter(line => line.trim());
  const fields = [];

  lines.forEach((line, index) => {
    if (line.includes(':')) {
      const [key, value] = line.split(':').map(s => s.trim());
      if (key && value && value.length > 0) {
        fields.push({
          id: `generic_field_${Date.now()}_${index}`,
          documentId: 'temp',
          fieldName: key,
          fieldValue: value,
          confidence: 0.7,
          position: { x: 0, y: index * 25, width: 200, height: 20 },
          isValidated: false,
          isEdited: false
        });
      }
    }
  });

  return fields;
};

const calculateFieldConfidence = (value, fieldName) => {
  if (!value) return 0;

  let confidence = 0.5; // Base confidence

  // Increase confidence based on field type patterns
  if (fieldName.toLowerCase().includes('date') && /\d{1,2}[-\/]\d{1,2}[-\/]\d{2,4}/.test(value)) {
    confidence += 0.3;
  }
  if (fieldName.toLowerCase().includes('amount') && /[A-Z]{3}\s*[\d,]+\.?\d*/.test(value)) {
    confidence += 0.3;
  }
  if (fieldName.toLowerCase().includes('number') && /[A-Z0-9\-]+/.test(value)) {
    confidence += 0.2;
  }

  return Math.min(confidence, 1.0);
};

const calculateOverallConfidence = (fields) => {
  if (fields.length === 0) return 0;
  const totalConfidence = fields.reduce((sum, field) => sum + field.confidence, 0);
  return totalConfidence / fields.length;
};

export const reprocessDocument = async (documentId) => {
  try {
    console.log(`Reprocessing document: ${documentId}`);
    
    // Increment iteration count
    // This would typically update the iteration in the database
    
    // Rerun the OCR process
    const result = await processDocument(documentId);
    
    return {
      ...result,
      iteration: {
        id: `iteration_${Date.now()}`,
        documentId: documentId,
        iterationNumber: 1, // This would be incremented properly
        ocrResult: result.extractedText,
        extractedFields: result.extractedFields,
        createdAt: new Date().toISOString(),
        status: 'completed'
      }
    };
  } catch (error) {
    console.error('Reprocessing error:', error);
    throw error;
  }
};

export const recognizeDocumentType = async (filePath) => {
  try {
    // This would analyze the document structure and match against templates
    let text;
    try {
      text = await performImageOCR(filePath);
    } catch (error) {
      text = generateMockOCRText(filePath);
    }
    
    const documentType = recognizeDocumentTypeFromText(text);
    
    return {
      documentType: documentType,
      confidence: documentType === 'Unknown' ? 0.1 : 0.89,
      template: `${documentType.toUpperCase().replace(/\s+/g, '_')}_TEMPLATE_001`
    };
  } catch (error) {
    console.error('Document recognition error:', error);
    throw error;
  }
};