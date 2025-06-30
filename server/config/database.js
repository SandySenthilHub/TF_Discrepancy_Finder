import sql from 'mssql';
import dotenv from 'dotenv';

dotenv.config();

const config = {
  server: process.env.DB_SERVER,
  database: process.env.DB_DATABASE,
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

let poolPromise;

const getPool = () => {
  if (!poolPromise) {
    poolPromise = new sql.ConnectionPool(config)
      .connect()
      .then(pool => {
        console.log('✅ Connected to Azure SQL Server - TF_genie database');
        console.log(`📍 Server: ${config.server}`);
        console.log(`🗄️  Database: ${config.database}`);
        console.log(`👤 User: ${config.user}`);
        return pool;
      })
      .catch(err => {
        console.error('❌ Database connection failed:', err.message);
        console.error('🔧 Connection details:');
        console.error(`   Server: ${config.server}`);
        console.error(`   Database: ${config.database}`);
        console.error(`   User: ${config.user}`);
        console.error(`   Port: ${config.port}`);
        console.error(`   Encrypt: ${config.options.encrypt}`);
        console.error(`   Trust Certificate: ${config.options.trustServerCertificate}`);
        poolPromise = null;
        throw err;
      });
  }
  return poolPromise;
};

// Test connection function
const testConnection = async () => {
  try {
    const pool = await getPool();
    const result = await pool.request().query('SELECT 1 as test');
    console.log('🧪 Database connection test: SUCCESS');
    return true;
  } catch (error) {
    console.error('🧪 Database connection test: FAILED');
    console.error('Error:', error.message);
    return false;
  }
};

export { sql, getPool, testConnection };