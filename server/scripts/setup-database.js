import sql from 'mssql';
import dotenv from 'dotenv';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

async function createDatabase() {
  let pool;
  
  try {
    console.log('🔌 Connecting to SQL Server...');
    console.log(`📍 Server: ${config.server}`);
    console.log(`👤 User: ${config.user}`);
    
    // Connect to master database first to create TF_genie database
    const masterConfig = { ...config, database: 'master' };
    pool = await sql.connect(masterConfig);
    
    console.log('✅ Connected to SQL Server (master database)');
    
    // Check if TF_genie database exists
    const checkDbResult = await pool.request().query(`
      SELECT name FROM sys.databases WHERE name = 'TF_genie'
    `);
    
    if (checkDbResult.recordset.length === 0) {
      console.log('🏗️  Creating TF_genie database...');
      await pool.request().query('CREATE DATABASE TF_genie');
      console.log('✅ TF_genie database created successfully!');
    } else {
      console.log('ℹ️  TF_genie database already exists');
    }
    
    // Close master connection
    await pool.close();
    
    // Connect to TF_genie database
    const tfGenieConfig = { ...config, database: 'TF_genie' };
    pool = await sql.connect(tfGenieConfig);
    
    console.log('✅ Connected to TF_genie database');
    
    // Read and execute the schema creation script
    const schemaPath = path.join(__dirname, '../../supabase/migrations/20250628071950_morning_prism.sql');
    const schemaSQL = fs.readFileSync(schemaPath, 'utf8');
    
    // Split the SQL into individual statements and execute them
    const statements = schemaSQL
      .split('GO')
      .map(stmt => stmt.trim())
      .filter(stmt => stmt.length > 0 && !stmt.startsWith('--') && !stmt.startsWith('USE'));
    
    console.log(`📝 Executing ${statements.length} SQL statements...`);
    
    for (let i = 0; i < statements.length; i++) {
      const statement = statements[i];
      if (statement.trim()) {
        try {
          await pool.request().query(statement);
          console.log(`✅ Statement ${i + 1}/${statements.length} executed successfully`);
        } catch (error) {
          if (!error.message.includes('already exists')) {
            console.error(`❌ Error executing statement ${i + 1}:`, error.message);
            console.error('Statement:', statement.substring(0, 100) + '...');
          }
        }
      }
    }
    
    // Verify tables were created
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log('\n📊 Tables created in TF_genie database:');
    tablesResult.recordset.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.TABLE_NAME}`);
    });
    
    // Verify default users
    const usersResult = await pool.request().query('SELECT email, name, role FROM users');
    console.log('\n👥 Default users created:');
    usersResult.recordset.forEach(user => {
      console.log(`   📧 ${user.email} (${user.name}) - Role: ${user.role}`);
    });
    
    console.log('\n🎉 Database setup completed successfully!');
    console.log('\n📋 Next steps:');
    console.log('   1. Start the backend server: npm run server');
    console.log('   2. Start the frontend: npm run dev');
    console.log('   3. Login with: admin@tradefi.com / password');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error);
    throw error;
  } finally {
    if (pool) {
      await pool.close();
    }
  }
}

// Run the setup
createDatabase()
  .then(() => {
    console.log('✅ Setup script completed');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup script failed:', error);
    process.exit(1);
  });