import { getPool, testConnection } from '../config/database.js';
import dotenv from 'dotenv';

// Load environment variables
dotenv.config();

async function setupDatabase() {
  console.log('🚀 Setting up TF_genie database...');
  
  try {
    // Test connection first
    console.log('🧪 Testing database connection...');
    const connectionSuccess = await testConnection();
    
    if (!connectionSuccess) {
      throw new Error('Database connection failed');
    }
    
    console.log('✅ Database connection successful!');
    
    // Get pool and verify tables exist
    const pool = await getPool();
    
    console.log('📋 Checking database tables...');
    const tablesResult = await pool.request().query(`
      SELECT TABLE_NAME 
      FROM INFORMATION_SCHEMA.TABLES 
      WHERE TABLE_TYPE = 'BASE TABLE'
      ORDER BY TABLE_NAME
    `);
    
    console.log(`📊 Found ${tablesResult.recordset.length} tables:`);
    tablesResult.recordset.forEach((table, index) => {
      console.log(`   ${index + 1}. ${table.TABLE_NAME}`);
    });
    
    // Check if users exist
    const usersResult = await pool.request().query('SELECT COUNT(*) as userCount FROM users');
    console.log(`👥 Users in database: ${usersResult.recordset[0].userCount}`);
    
    if (usersResult.recordset[0].userCount === 0) {
      console.log('⚠️  No users found. You may need to run the database migration script.');
    } else {
      // Show existing users
      const allUsersResult = await pool.request().query('SELECT email, name, role FROM users');
      console.log('👥 Existing users:');
      allUsersResult.recordset.forEach(user => {
        console.log(`   📧 ${user.email} (${user.name}) - Role: ${user.role}`);
      });
    }
    
    console.log('');
    console.log('🎉 Database setup verification completed!');
    console.log('🚀 You can now start the application servers:');
    console.log('   Backend: npm run server');
    console.log('   Frontend: npm run dev');
    
  } catch (error) {
    console.error('❌ Database setup failed:', error.message);
    console.error('');
    console.error('🔧 Troubleshooting steps:');
    console.error('1. Ensure SQL Server is running on DESKTOP-LQDEBH0');
    console.error('2. Verify the TF_genie database exists');
    console.error('3. Check that the sa user has the correct password');
    console.error('4. Ensure TCP/IP is enabled in SQL Server Configuration Manager');
    console.error('5. Check Windows Firewall settings for port 1433');
    throw error;
  }
}

// Run the setup
setupDatabase()
  .then(() => {
    console.log('✅ Setup completed successfully!');
    process.exit(0);
  })
  .catch((error) => {
    console.error('❌ Setup failed:', error.message);
    process.exit(1);
  });