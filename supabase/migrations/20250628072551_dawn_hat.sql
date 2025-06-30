-- TF_genie Database Complete Setup Script
-- Copy this entire script and execute it in SQL Server Management Studio

-- Step 1: Create the TF_genie database
IF NOT EXISTS (SELECT name FROM sys.databases WHERE name = 'TF_genie')
BEGIN
    CREATE DATABASE TF_genie;
    PRINT 'TF_genie database created successfully!';
END
ELSE
BEGIN
    PRINT 'TF_genie database already exists.';
END
GO

-- Step 2: Use the TF_genie database
USE TF_genie;
GO

-- Step 3: Create all tables

-- Users table
CREATE TABLE users (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    email NVARCHAR(255) UNIQUE NOT NULL,
    name NVARCHAR(255) NOT NULL,
    password NVARCHAR(255) NOT NULL,
    role NVARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
    createdAt DATETIME2 DEFAULT GETDATE(),
    updatedAt DATETIME2 DEFAULT GETDATE()
);
GO

-- Session table
CREATE TABLE ingestion_session (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    cifNumber NVARCHAR(50) NOT NULL,
    lcNumber NVARCHAR(50) NOT NULL,
    lifecycle NVARCHAR(100) NOT NULL,
    status NVARCHAR(20) DEFAULT 'created' CHECK (status IN ('created', 'uploading', 'processing', 'reviewing', 'completed', 'frozen')),
    userId UNIQUEIDENTIFIER NOT NULL,
    iterations INT DEFAULT 0,
    createdAt DATETIME2 DEFAULT GETDATE(),
    updatedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (userId) REFERENCES users(id)
);
GO

-- Raw documents table
CREATE TABLE ingestion_document_raw (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    sessionId UNIQUEIDENTIFIER NOT NULL,
    fileName NVARCHAR(255) NOT NULL,
    fileType NVARCHAR(50) NOT NULL,
    fileSize BIGINT NOT NULL,
    filePath NVARCHAR(500) NOT NULL,
    status NVARCHAR(20) DEFAULT 'uploaded' CHECK (status IN ('uploaded', 'processing', 'processed', 'validated', 'error')),
    uploadedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (sessionId) REFERENCES ingestion_session(id) ON DELETE CASCADE
);
GO

-- Cleaned documents table
CREATE TABLE ingestion_document_cleaned (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    documentId UNIQUEIDENTIFIER NOT NULL,
    sessionId UNIQUEIDENTIFIER NOT NULL,
    cleanedContent NTEXT,
    extractedFields NTEXT,
    matchedTemplate NVARCHAR(100),
    isNewDocument BIT DEFAULT 0,
    processedAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (documentId) REFERENCES ingestion_document_raw(id) ON DELETE CASCADE,
    FOREIGN KEY (sessionId) REFERENCES ingestion_session(id) ON DELETE CASCADE
);
GO

-- Fields table
CREATE TABLE ingestion_fields (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    documentId UNIQUEIDENTIFIER NOT NULL,
    sessionId UNIQUEIDENTIFIER NOT NULL,
    fieldName NVARCHAR(100) NOT NULL,
    fieldValue NVARCHAR(MAX),
    confidence DECIMAL(3,2),
    positionX INT,
    positionY INT,
    width INT,
    height INT,
    isValidated BIT DEFAULT 0,
    isEdited BIT DEFAULT 0,
    createdAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (documentId) REFERENCES ingestion_document_raw(id) ON DELETE CASCADE,
    FOREIGN KEY (sessionId) REFERENCES ingestion_session(id) ON DELETE CASCADE
);
GO

-- Key-value pairs table
CREATE TABLE ingestion_keyValuePair (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    sessionId UNIQUEIDENTIFIER NOT NULL,
    documentId UNIQUEIDENTIFIER NOT NULL,
    keyName NVARCHAR(100) NOT NULL,
    keyValue NVARCHAR(MAX),
    dataType NVARCHAR(50),
    source NVARCHAR(20) DEFAULT 'extracted' CHECK (source IN ('extracted', 'manual', 'validated')),
    createdAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (sessionId) REFERENCES ingestion_session(id) ON DELETE CASCADE,
    FOREIGN KEY (documentId) REFERENCES ingestion_document_raw(id) ON DELETE CASCADE
);
GO

-- New documents table
CREATE TABLE ingestion_documents_new (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    sessionId UNIQUEIDENTIFIER NOT NULL,
    documentId UNIQUEIDENTIFIER NOT NULL,
    documentType NVARCHAR(100),
    documentCategory NVARCHAR(100),
    approvalStatus NVARCHAR(20) DEFAULT 'pending' CHECK (approvalStatus IN ('pending', 'approved', 'rejected')),
    requestedBy UNIQUEIDENTIFIER NOT NULL,
    requestedAt DATETIME2 DEFAULT GETDATE(),
    approvedBy UNIQUEIDENTIFIER NULL,
    approvedAt DATETIME2 NULL,
    adminNotes NVARCHAR(MAX),
    FOREIGN KEY (sessionId) REFERENCES ingestion_session(id) ON DELETE CASCADE,
    FOREIGN KEY (documentId) REFERENCES ingestion_document_raw(id) ON DELETE CASCADE,
    FOREIGN KEY (requestedBy) REFERENCES users(id),
    FOREIGN KEY (approvedBy) REFERENCES users(id)
);
GO

-- New document fields table
CREATE TABLE ingestion_documents_fields_new (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    newDocumentId UNIQUEIDENTIFIER NOT NULL,
    fieldName NVARCHAR(100) NOT NULL,
    fieldType NVARCHAR(50) NOT NULL,
    isRequired BIT DEFAULT 0,
    validationRules NVARCHAR(MAX),
    createdAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (newDocumentId) REFERENCES ingestion_documents_new(id) ON DELETE CASCADE
);
GO

-- Master record table
CREATE TABLE TF_master_record (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    sessionId UNIQUEIDENTIFIER NOT NULL,
    cifNumber NVARCHAR(50) NOT NULL,
    lcNumber NVARCHAR(50) NOT NULL,
    lifecycle NVARCHAR(100) NOT NULL,
    totalDocuments INT DEFAULT 0,
    processedAt DATETIME2 DEFAULT GETDATE(),
    createdBy UNIQUEIDENTIFIER NOT NULL,
    FOREIGN KEY (sessionId) REFERENCES ingestion_session(id),
    FOREIGN KEY (createdBy) REFERENCES users(id)
);
GO

-- Master document set table
CREATE TABLE TF_master_documentset (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    masterRecordId UNIQUEIDENTIFIER NOT NULL,
    documentType NVARCHAR(100) NOT NULL,
    documentCategory NVARCHAR(100),
    documentPath NVARCHAR(500),
    extractedContent NTEXT,
    createdAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (masterRecordId) REFERENCES TF_master_record(id) ON DELETE CASCADE
);
GO

-- Master key-value pairs table
CREATE TABLE TF_key_value_pair (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    masterRecordId UNIQUEIDENTIFIER NOT NULL,
    documentSetId UNIQUEIDENTIFIER NOT NULL,
    keyName NVARCHAR(100) NOT NULL,
    keyValue NVARCHAR(MAX),
    dataType NVARCHAR(50),
    createdAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (masterRecordId) REFERENCES TF_master_record(id) ON DELETE CASCADE,
    FOREIGN KEY (documentSetId) REFERENCES TF_master_documentset(id) ON DELETE CASCADE
);
GO

-- Master fields table
CREATE TABLE TF_master_fields (
    id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
    documentSetId UNIQUEIDENTIFIER NOT NULL,
    fieldName NVARCHAR(100) NOT NULL,
    fieldValue NVARCHAR(MAX),
    fieldType NVARCHAR(50),
    confidence DECIMAL(3,2),
    isValidated BIT DEFAULT 1,
    createdAt DATETIME2 DEFAULT GETDATE(),
    FOREIGN KEY (documentSetId) REFERENCES TF_master_documentset(id) ON DELETE CASCADE
);
GO

-- Step 4: Create indexes for better performance
CREATE INDEX IX_ingestion_session_userId ON ingestion_session(userId);
CREATE INDEX IX_ingestion_session_status ON ingestion_session(status);
CREATE INDEX IX_ingestion_document_raw_sessionId ON ingestion_document_raw(sessionId);
CREATE INDEX IX_ingestion_fields_documentId ON ingestion_fields(documentId);
CREATE INDEX IX_ingestion_fields_sessionId ON ingestion_fields(sessionId);
CREATE INDEX IX_ingestion_keyValuePair_sessionId ON ingestion_keyValuePair(sessionId);
GO

-- Step 5: Insert default users (password is 'password' for both)
INSERT INTO users (email, name, password, role) 
VALUES ('admin@tradefi.com', 'System Administrator', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin');

INSERT INTO users (email, name, password, role) 
VALUES ('user@tradefi.com', 'Regular User', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user');
GO

-- Step 6: Verification
PRINT 'TF_genie database setup completed successfully!';
PRINT '';
PRINT 'Database: TF_genie';
PRINT 'Tables created: 12';
PRINT 'Default users created:';
PRINT '  Admin: admin@tradefi.com / password';
PRINT '  User: user@tradefi.com / password';
PRINT '';
PRINT 'You can now start the application!';

-- Show all created tables
SELECT TABLE_NAME as 'Created Tables'
FROM INFORMATION_SCHEMA.TABLES 
WHERE TABLE_TYPE = 'BASE TABLE'
ORDER BY TABLE_NAME;