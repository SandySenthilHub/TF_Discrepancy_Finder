import { testConnection } from '../config/database.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

console.log('🚀 Testing Azure SQL Database Connection...');
console.log('📋 Configuration:');
console.log(`   Server: ${process.env.DB_SERVER}`);
console.log(`   Database: ${process.env.DB_DATABASE}`);
console.log(`   User: ${process.env.DB_USER}`);
console.log(`   Port: ${process.env.DB_PORT || 1433}`);
console.log(`   Encrypt: ${process.env.DB_ENCRYPT}`);
console.log(`   Trust Certificate: ${process.env.DB_TRUST_SERVER_CERTIFICATE}`);
console.log('');

testConnection()
  .then((success) => {
    if (success) {
      console.log('✅ Connection test completed successfully!');
      console.log('🎉 Your application should now be able to connect to the database.');
    } else {
      console.log('❌ Connection test failed!');
      console.log('🔧 Please check your database configuration and ensure:');
      console.log('   1. SQL Server is running');
      console.log('   2. TCP/IP is enabled in SQL Server Configuration Manager');
      console.log('   3. SQL Server Browser service is running');
      console.log('   4. Firewall allows connections on port 1433');
      console.log('   5. Mixed mode authentication is enabled');
    }
    process.exit(success ? 0 : 1);
  })
  .catch((error) => {
    console.error('❌ Connection test error:', error.message);
    process.exit(1);
  });