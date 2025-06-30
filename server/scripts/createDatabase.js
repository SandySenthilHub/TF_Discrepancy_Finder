import sql from 'mssql';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

const config = {
  server: process.env.DB_SERVER,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  port: parseInt(process.env.DB_PORT) || 1433,
  options: {
    encrypt: process.env.DB_ENCRYPT === 'true',
    trustServerCertificate: process.env.DB_TRUST_SERVER_CERTIFICATE === 'true',
    enableArithAbort: true,
    connectionTimeout: 30000,
    requestTimeout: 30000,
  },
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000,
  },
};

async function createTFGenieDatabase() {
  let pool;
  
  try {
    console.log('🚀 Starting automated database creation...');
    console.log(`📍 Server: ${config.server}`);
    console.log(`👤 User: ${config.user}`);
    
    // Step 1: Connect to master database to create TF_genie
    console.log('\n🔌 Connecting to SQL Server (master database)...');
    const masterConfig = { ...config, database: 'master' };
    pool = await sql.connect(masterConfig);
    console.log('✅ Connected to master database');
    
    // Step 2: Create TF_genie database if it doesn't exist
    console.log('\n🏗️  Checking if TF_genie database exists...');
    const checkDbResult = await pool.request().query(`
      SELECT name FROM sys.databases WHERE name = 'TF_genie'
    `);
    
    if (checkDbResult.recordset.length === 0) {
      console.log('📦 Creating TF_genie database...');
      await pool.request().query('CREATE DATABASE TF_genie');
      console.log('✅ TF_genie database created successfully!');
    } else {
      console.log('ℹ️  TF_genie database already exists');
    }
    
    // Close master connection
    await pool.close();
    
    // Step 3: Connect to TF_genie database
    console.log('\n🔗 Connecting to TF_genie database...');
    const tfGenieConfig = { ...config, database: 'TF_genie' };
    pool = await sql.connect(tfGenieConfig);
    console.log('✅ Connected to TF_genie database');
    
    // Step 4: Create all tables
    console.log('\n📋 Creating database tables...');
    
    // Users table
    await createUsersTable(pool);
    
    // Session table
    await createSessionTable(pool);
    
    // Document tables
    await createDocumentTables(pool);
    
    // Field tables
    await createFieldTables(pool);
    
    // Master record tables
    await createMasterTables(pool);
    
    // Create indexes
    await createIndexes(pool);
    
    // Insert default users
    await insertDefaultUsers(pool);
    
    // Verify setup
    await verifySetup(pool);
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. The backend server should now connect successfully');
    console.log('   2. Start the frontend: npm run dev');
    console.log('   3. Login with: admin@tradefi.com / password');
    
  } catch (error) {
    console.error('\n❌ Database setup failed:', error.message);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

async function createUsersTable(pool) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='users' AND xtype='U')
      CREATE TABLE users (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          email NVARCHAR(255) UNIQUE NOT NULL,
          name NVARCHAR(255) NOT NULL,
          password NVARCHAR(255) NOT NULL,
          role NVARCHAR(20) DEFAULT 'user' CHECK (role IN ('user', 'admin')),
          createdAt DATETIME2 DEFAULT GETDATE(),
          updatedAt DATETIME2 DEFAULT GETDATE()
      )
    `);
    console.log('✅ Users table created');
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
}

async function createSessionTable(pool) {
  try {
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ingestion_session' AND xtype='U')
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
      )
    `);
    console.log('✅ Session table created');
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
}

async function createDocumentTables(pool) {
  try {
    // Raw documents table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ingestion_document_raw' AND xtype='U')
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
      )
    `);
    
    // Cleaned documents table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ingestion_document_cleaned' AND xtype='U')
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
      )
    `);
    
    // New documents table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ingestion_documents_new' AND xtype='U')
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
      )
    `);
    
    console.log('✅ Document tables created');
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
}

async function createFieldTables(pool) {
  try {
    // Fields table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ingestion_fields' AND xtype='U')
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
      )
    `);
    
    // Key-value pairs table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ingestion_keyValuePair' AND xtype='U')
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
      )
    `);
    
    // New document fields table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='ingestion_documents_fields_new' AND xtype='U')
      CREATE TABLE ingestion_documents_fields_new (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          newDocumentId UNIQUEIDENTIFIER NOT NULL,
          fieldName NVARCHAR(100) NOT NULL,
          fieldType NVARCHAR(50) NOT NULL,
          isRequired BIT DEFAULT 0,
          validationRules NVARCHAR(MAX),
          createdAt DATETIME2 DEFAULT GETDATE(),
          FOREIGN KEY (newDocumentId) REFERENCES ingestion_documents_new(id) ON DELETE CASCADE
      )
    `);
    
    console.log('✅ Field tables created');
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
}

async function createMasterTables(pool) {
  try {
    // Master record table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TF_master_record' AND xtype='U')
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
      )
    `);
    
    // Master document set table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TF_master_documentset' AND xtype='U')
      CREATE TABLE TF_master_documentset (
          id UNIQUEIDENTIFIER PRIMARY KEY DEFAULT NEWID(),
          masterRecordId UNIQUEIDENTIFIER NOT NULL,
          documentType NVARCHAR(100) NOT NULL,
          documentCategory NVARCHAR(100),
          documentPath NVARCHAR(500),
          extractedContent NTEXT,
          createdAt DATETIME2 DEFAULT GETDATE(),
          FOREIGN KEY (masterRecordId) REFERENCES TF_master_record(id) ON DELETE CASCADE
      )
    `);
    
    // Master key-value pairs table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TF_key_value_pair' AND xtype='U')
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
      )
    `);
    
    // Master fields table
    await pool.request().query(`
      IF NOT EXISTS (SELECT * FROM sysobjects WHERE name='TF_master_fields' AND xtype='U')
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
      )
    `);
    
    console.log('✅ Master tables created');
  } catch (error) {
    if (!error.message.includes('already exists')) {
      throw error;
    }
  }
}

async function createIndexes(pool) {
  try {
    const indexes = [
      'CREATE INDEX IX_ingestion_session_userId ON ingestion_session(userId)',
      'CREATE INDEX IX_ingestion_session_status ON ingestion_session(status)',
      'CREATE INDEX IX_ingestion_document_raw_sessionId ON ingestion_document_raw(sessionId)',
      'CREATE INDEX IX_ingestion_fields_documentId ON ingestion_fields(documentId)',
      'CREATE INDEX IX_ingestion_fields_sessionId ON ingestion_fields(sessionId)',
      'CREATE INDEX IX_ingestion_keyValuePair_sessionId ON ingestion_keyValuePair(sessionId)'
    ];
    
    for (const indexSQL of indexes) {
      try {
        await pool.request().query(indexSQL);
      } catch (error) {
        if (!error.message.includes('already exists')) {
          console.log(`⚠️  Index creation warning: ${error.message}`);
        }
      }
    }
    
    console.log('✅ Database indexes created');
  } catch (error) {
    console.log('⚠️  Some indexes may already exist');
  }
}

async function insertDefaultUsers(pool) {
  try {
    // Check if admin user exists
    const adminCheck = await pool.request().query(`
      SELECT COUNT(*) as count FROM users WHERE email = 'admin@tradefi.com'
    `);
    
    if (adminCheck.recordset[0].count === 0) {
      await pool.request().query(`
        INSERT INTO users (email, name, password, role) 
        VALUES ('admin@tradefi.com', 'System Administrator', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'admin')
      `);
      console.log('✅ Admin user created');
    }
    
    // Check if regular user exists
    const userCheck = await pool.request().query(`
      SELECT COUNT(*) as count FROM users WHERE email = 'user@tradefi.com'
    `);
    
    if (userCheck.recordset[0].count === 0) {
      await pool.request().query(`
        INSERT INTO users (email, name, password, role) 
        VALUES ('user@tradefi.com', 'Regular User', '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi', 'user')
      `);
      console.log('✅ Regular user created');
    }
    
    console.log('✅ Default users verified');
  } catch (error) {
    console.error('❌ Error creating default users:', error.message);
  }
}

async function verifySetup(pool) {
  try {
    // Count tables
    const tablesResult = await pool.request().query(`
      SELECT COUNT(*) as tableCount 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
    `);
    
    // Count users
    const usersResult = await pool.request().query('SELECT COUNT(*) as userCount FROM users');
    
    console.log('\n📊 Setup Verification:');
    console.log(`   📋 Tables created: ${tablesResult.recordset[0].tableCount}`);
    console.log(`   👥 Users created: ${usersResult.recordset[0].userCount}`);
    
    // List all tables
    const allTablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log('\n📋 Database Tables:');
    allTablesResult.recordset.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.TABLE_NAME}`);
    });
    
  } catch (error) {
    console.error('❌ Verification failed:', error.message);
  }
}

export { createTFGenieDatabase };