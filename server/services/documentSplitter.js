import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { DocumentModel } from '../models/Document.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Document type patterns and signatures
const DOCUMENT_SIGNATURES = {
  'Letter of Credit': {
    startPatterns: [
      /IRREVOCABLE\s+DOCUMENTARY\s+CREDIT/i,
      /LETTER\s+OF\s+CREDIT/i,
      /DOCUMENTARY\s+CREDIT/i,
      /LC\s+NUMBER/i,
      /CREDIT\s+NUMBER/i
    ],
    endPatterns: [
      /END\s+OF\s+CREDIT/i,
      /CREDIT\s+EXPIRES/i,
      /UCP\s+600/i,
      /AUTHORIZED\s+SIGNATURE/i
    ],
    keywords: ['beneficiary', 'applicant', 'expiry', 'amount', 'documents required']
  },
  'Commercial Invoice': {
    startPatterns: [
      /COMMERCIAL\s+INVOICE/i,
      /INVOICE\s+NUMBER/i,
      /INVOICE\s+DATE/i,
      /SOLD\s+TO/i,
      /BILL\s+TO/i
    ],
    endPatterns: [
      /TOTAL\s+AMOUNT/i,
      /GRAND\s+TOTAL/i,
      /PAYMENT\s+TERMS/i,
      /THANK\s+YOU/i
    ],
    keywords: ['invoice', 'quantity', 'unit price', 'total', 'description']
  },
  'Bill of Lading': {
    startPatterns: [
      /BILL\s+OF\s+LADING/i,
      /B\/L\s+NUMBER/i,
      /SHIPPED\s+ON\s+BOARD/i,
      /VESSEL/i,
      /PORT\s+OF\s+LOADING/i
    ],
    endPatterns: [
      /FREIGHT\s+PREPAID/i,
      /FREIGHT\s+COLLECT/i,
      /SHIPPED\s+ON\s+BOARD/i,
      /MASTER'S\s+SIGNATURE/i
    ],
    keywords: ['consignee', 'shipper', 'vessel', 'port', 'cargo']
  },
  'Packing List': {
    startPatterns: [
      /PACKING\s+LIST/i,
      /PACKAGE\s+LIST/i,
      /GROSS\s+WEIGHT/i,
      /NET\s+WEIGHT/i,
      /PACKAGES/i
    ],
    endPatterns: [
      /TOTAL\s+PACKAGES/i,
      /TOTAL\s+WEIGHT/i,
      /MEASUREMENT/i,
      /DIMENSIONS/i
    ],
    keywords: ['packages', 'weight', 'dimensions', 'cartons', 'pieces']
  },
  'Certificate of Origin': {
    startPatterns: [
      /CERTIFICATE\s+OF\s+ORIGIN/i,
      /COUNTRY\s+OF\s+ORIGIN/i,
      /CHAMBER\s+OF\s+COMMERCE/i,
      /ORIGIN\s+CERTIFICATE/i
    ],
    endPatterns: [
      /CHAMBER\s+SEAL/i,
      /AUTHORIZED\s+SIGNATURE/i,
      /CERTIFICATE\s+NUMBER/i,
      /DATE\s+OF\s+ISSUE/i
    ],
    keywords: ['origin', 'country', 'goods', 'certificate', 'chamber']
  },
  'Insurance Certificate': {
    startPatterns: [
      /INSURANCE\s+CERTIFICATE/i,
      /POLICY\s+NUMBER/i,
      /INSURED\s+AMOUNT/i,
      /COVERAGE/i,
      /MARINE\s+INSURANCE/i
    ],
    endPatterns: [
      /POLICY\s+EXPIRES/i,
      /INSURER'S\s+SIGNATURE/i,
      /CLAIMS\s+PAYABLE/i,
      /COVERAGE\s+ENDS/i
    ],
    keywords: ['insurance', 'policy', 'coverage', 'premium', 'claims']
  }
};

export const splitDocumentByFormType = async (documentId, extractedText) => {
  try {
    console.log(`Starting document splitting for: ${documentId}`);
    
    // Clean and normalize the text
    const normalizedText = extractedText.replace(/\s+/g, ' ').trim();
    const lines = normalizedText.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    
    // Find document boundaries
    const documentSections = findDocumentSections(lines, normalizedText);
    
    // If no clear sections found, treat as single document
    if (documentSections.length === 0) {
      const documentType = identifyDocumentType(normalizedText);
      documentSections.push({
        type: documentType,
        startIndex: 0,
        endIndex: lines.length - 1,
        content: normalizedText,
        confidence: 0.7
      });
    }
    
    // Create split documents
    const splitDocuments = [];
    
    for (let i = 0; i < documentSections.length; i++) {
      const section = documentSections[i];
      const splitDoc = {
        id: `${documentId}_split_${i + 1}`,
        originalDocumentId: documentId,
        splitIndex: i + 1,
        documentType: section.type,
        content: section.content,
        extractedText: section.content,
        confidence: section.confidence,
        pageRange: {
          start: Math.floor(section.startIndex / 50) + 1, // Estimate page numbers
          end: Math.floor(section.endIndex / 50) + 1
        },
        extractedFields: extractFieldsFromSection(section.content, section.type),
        metadata: {
          lineStart: section.startIndex,
          lineEnd: section.endIndex,
          wordCount: section.content.split(' ').length,
          characterCount: section.content.length
        }
      };
      
      splitDocuments.push(splitDoc);
    }
    
    console.log(`Document split into ${splitDocuments.length} sections`);
    
    // Save split information to database
    await saveSplitDocuments(documentId, splitDocuments);
    
    return {
      originalDocumentId: documentId,
      splitCount: splitDocuments.length,
      splitDocuments: splitDocuments,
      processingTime: new Date().toISOString()
    };
    
  } catch (error) {
    console.error('Error splitting document:', error);
    throw error;
  }
};

function findDocumentSections(lines, fullText) {
  const sections = [];
  let currentSection = null;
  
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const lineText = line.toLowerCase();
    
    // Check for document start patterns
    for (const [docType, signature] of Object.entries(DOCUMENT_SIGNATURES)) {
      const isStartPattern = signature.startPatterns.some(pattern => pattern.test(line));
      
      if (isStartPattern) {
        // End previous section if exists
        if (currentSection) {
          currentSection.endIndex = i - 1;
          currentSection.content = lines.slice(currentSection.startIndex, i).join('\n');
          sections.push(currentSection);
        }
        
        // Start new section
        currentSection = {
          type: docType,
          startIndex: i,
          endIndex: lines.length - 1, // Default to end
          content: '',
          confidence: calculateDocumentConfidence(line, docType)
        };
        
        console.log(`Found ${docType} starting at line ${i}: ${line.substring(0, 50)}...`);
        break;
      }
    }
    
    // Check for document end patterns
    if (currentSection) {
      const signature = DOCUMENT_SIGNATURES[currentSection.type];
      const isEndPattern = signature.endPatterns.some(pattern => pattern.test(line));
      
      if (isEndPattern) {
        currentSection.endIndex = i;
        currentSection.content = lines.slice(currentSection.startIndex, i + 1).join('\n');
        sections.push(currentSection);
        currentSection = null;
        
        console.log(`Ended ${currentSection?.type} at line ${i}`);
      }
    }
  }
  
  // Handle last section if still open
  if (currentSection) {
    currentSection.content = lines.slice(currentSection.startIndex).join('\n');
    sections.push(currentSection);
  }
  
  // Post-process sections to improve accuracy
  return refineSections(sections, fullText);
}

function refineSections(sections, fullText) {
  return sections.map(section => {
    // Recalculate confidence based on content analysis
    const keywordMatches = countKeywordMatches(section.content, section.type);
    const structureScore = analyzeDocumentStructure(section.content, section.type);
    
    section.confidence = Math.min(0.95, (keywordMatches * 0.4 + structureScore * 0.6));
    
    // Ensure minimum content length
    if (section.content.length < 100) {
      section.confidence *= 0.5;
    }
    
    return section;
  }).filter(section => section.confidence > 0.3); // Filter out low-confidence sections
}

function identifyDocumentType(text) {
  let bestMatch = 'Unknown Document';
  let highestScore = 0;
  
  for (const [docType, signature] of Object.entries(DOCUMENT_SIGNATURES)) {
    const keywordScore = countKeywordMatches(text, docType);
    const patternScore = signature.startPatterns.reduce((score, pattern) => {
      return score + (pattern.test(text) ? 1 : 0);
    }, 0) / signature.startPatterns.length;
    
    const totalScore = keywordScore * 0.6 + patternScore * 0.4;
    
    if (totalScore > highestScore) {
      highestScore = totalScore;
      bestMatch = docType;
    }
  }
  
  return highestScore > 0.3 ? bestMatch : 'Unknown Document';
}

function countKeywordMatches(text, documentType) {
  const signature = DOCUMENT_SIGNATURES[documentType];
  if (!signature) return 0;
  
  const lowerText = text.toLowerCase();
  const matches = signature.keywords.filter(keyword => 
    lowerText.includes(keyword.toLowerCase())
  ).length;
  
  return matches / signature.keywords.length;
}

function analyzeDocumentStructure(text, documentType) {
  // Analyze document structure based on type
  const lines = text.split('\n').filter(line => line.trim().length > 0);
  
  switch (documentType) {
    case 'Letter of Credit':
      return analyzeLCStructure(lines);
    case 'Commercial Invoice':
      return analyzeInvoiceStructure(lines);
    case 'Bill of Lading':
      return analyzeBLStructure(lines);
    default:
      return 0.5; // Default structure score
  }
}

function analyzeLCStructure(lines) {
  let score = 0;
  const requiredSections = ['lc number', 'beneficiary', 'applicant', 'amount', 'expiry'];
  
  requiredSections.forEach(section => {
    if (lines.some(line => line.toLowerCase().includes(section))) {
      score += 0.2;
    }
  });
  
  return score;
}

function analyzeInvoiceStructure(lines) {
  let score = 0;
  const requiredSections = ['invoice number', 'date', 'total', 'description'];
  
  requiredSections.forEach(section => {
    if (lines.some(line => line.toLowerCase().includes(section))) {
      score += 0.25;
    }
  });
  
  return score;
}

function analyzeBLStructure(lines) {
  let score = 0;
  const requiredSections = ['vessel', 'port', 'consignee', 'shipper'];
  
  requiredSections.forEach(section => {
    if (lines.some(line => line.toLowerCase().includes(section))) {
      score += 0.25;
    }
  });
  
  return score;
}

function calculateDocumentConfidence(line, documentType) {
  const signature = DOCUMENT_SIGNATURES[documentType];
  if (!signature) return 0.5;
  
  const matchingPatterns = signature.startPatterns.filter(pattern => pattern.test(line)).length;
  return Math.min(0.9, 0.5 + (matchingPatterns * 0.2));
}

function extractFieldsFromSection(content, documentType) {
  const fields = [];
  const lines = content.split('\n');
  
  // Extract fields based on document type
  switch (documentType) {
    case 'Letter of Credit':
      fields.push(...extractLCFields(content, lines));
      break;
    case 'Commercial Invoice':
      fields.push(...extractInvoiceFields(content, lines));
      break;
    case 'Bill of Lading':
      fields.push(...extractBLFields(content, lines));
      break;
    case 'Packing List':
      fields.push(...extractPackingListFields(content, lines));
      break;
    case 'Certificate of Origin':
      fields.push(...extractOriginFields(content, lines));
      break;
    case 'Insurance Certificate':
      fields.push(...extractInsuranceFields(content, lines));
      break;
    default:
      fields.push(...extractGenericFields(content, lines));
  }
  
  return fields;
}

function extractLCFields(content, lines) {
  const fields = [];
  
  // LC Number
  const lcNumberMatch = content.match(/(?:lc|letter of credit|credit)\s*(?:number|no\.?|#)?\s*:?\s*([A-Z0-9\-]+)/i);
  if (lcNumberMatch) {
    fields.push({
      fieldName: 'LC Number',
      fieldValue: lcNumberMatch[1],
      confidence: 0.9
    });
  }
  
  // Amount
  const amountMatch = content.match(/(?:amount|value)\s*:?\s*([A-Z]{3}\s*[\d,]+\.?\d*)/i);
  if (amountMatch) {
    fields.push({
      fieldName: 'Amount',
      fieldValue: amountMatch[1],
      confidence: 0.85
    });
  }
  
  // Beneficiary
  const beneficiaryMatch = content.match(/beneficiary\s*:?\s*([^\n]+)/i);
  if (beneficiaryMatch) {
    fields.push({
      fieldName: 'Beneficiary',
      fieldValue: beneficiaryMatch[1].trim(),
      confidence: 0.8
    });
  }
  
  // Applicant
  const applicantMatch = content.match(/applicant\s*:?\s*([^\n]+)/i);
  if (applicantMatch) {
    fields.push({
      fieldName: 'Applicant',
      fieldValue: applicantMatch[1].trim(),
      confidence: 0.8
    });
  }
  
  return fields;
}

function extractInvoiceFields(content, lines) {
  const fields = [];
  
  // Invoice Number
  const invoiceMatch = content.match(/invoice\s*(?:number|no\.?|#)?\s*:?\s*([A-Z0-9\-]+)/i);
  if (invoiceMatch) {
    fields.push({
      fieldName: 'Invoice Number',
      fieldValue: invoiceMatch[1],
      confidence: 0.9
    });
  }
  
  // Total Amount
  const totalMatch = content.match(/(?:total|grand total)\s*:?\s*([A-Z]{3}\s*[\d,]+\.?\d*)/i);
  if (totalMatch) {
    fields.push({
      fieldName: 'Total Amount',
      fieldValue: totalMatch[1],
      confidence: 0.85
    });
  }
  
  return fields;
}

function extractBLFields(content, lines) {
  const fields = [];
  
  // B/L Number
  const blMatch = content.match(/(?:b\/l|bill of lading)\s*(?:number|no\.?|#)?\s*:?\s*([A-Z0-9\-]+)/i);
  if (blMatch) {
    fields.push({
      fieldName: 'B/L Number',
      fieldValue: blMatch[1],
      confidence: 0.9
    });
  }
  
  // Vessel
  const vesselMatch = content.match(/vessel\s*:?\s*([^\n]+)/i);
  if (vesselMatch) {
    fields.push({
      fieldName: 'Vessel',
      fieldValue: vesselMatch[1].trim(),
      confidence: 0.8
    });
  }
  
  return fields;
}

function extractPackingListFields(content, lines) {
  const fields = [];
  
  // Total Packages
  const packagesMatch = content.match(/(?:total\s+)?packages?\s*:?\s*(\d+)/i);
  if (packagesMatch) {
    fields.push({
      fieldName: 'Total Packages',
      fieldValue: packagesMatch[1],
      confidence: 0.85
    });
  }
  
  return fields;
}

function extractOriginFields(content, lines) {
  const fields = [];
  
  // Country of Origin
  const countryMatch = content.match(/country\s+of\s+origin\s*:?\s*([^\n]+)/i);
  if (countryMatch) {
    fields.push({
      fieldName: 'Country of Origin',
      fieldValue: countryMatch[1].trim(),
      confidence: 0.9
    });
  }
  
  return fields;
}

function extractInsuranceFields(content, lines) {
  const fields = [];
  
  // Policy Number
  const policyMatch = content.match(/policy\s*(?:number|no\.?|#)?\s*:?\s*([A-Z0-9\-]+)/i);
  if (policyMatch) {
    fields.push({
      fieldName: 'Policy Number',
      fieldValue: policyMatch[1],
      confidence: 0.9
    });
  }
  
  return fields;
}

function extractGenericFields(content, lines) {
  const fields = [];
  
  // Look for key-value pairs
  lines.forEach(line => {
    const kvMatch = line.match(/^([^:]+):\s*(.+)$/);
    if (kvMatch && kvMatch[1].length < 50 && kvMatch[2].length < 200) {
      fields.push({
        fieldName: kvMatch[1].trim(),
        fieldValue: kvMatch[2].trim(),
        confidence: 0.6
      });
    }
  });
  
  return fields.slice(0, 10); // Limit to 10 fields
}

async function saveSplitDocuments(originalDocumentId, splitDocuments) {
  try {
    // Save split document information to database
    // This would typically involve creating records in a split_documents table
    console.log(`Saving ${splitDocuments.length} split documents for ${originalDocumentId}`);
    
    // For now, we'll store this information in the cleaned document table
    const splitData = {
      documentId: originalDocumentId,
      sessionId: null, // Will be set by caller
      cleanedContent: JSON.stringify(splitDocuments),
      extractedFields: splitDocuments.flatMap(doc => doc.extractedFields),
      matchedTemplate: 'Split Document',
      isNewDocument: false
    };
    
    // This would be called by the main OCR service
    return splitData;
    
  } catch (error) {
    console.error('Error saving split documents:', error);
    throw error;
  }
}