import { createTFGenieDatabase } from './createDatabase.js';

// Run the database setup
createTFGenieDatabase()
  .then(() => {
    console.log('\n🎉 Automated database setup completed successfully!');
    console.log('🚀 You can now start the application servers.');
    process.exit(0);
  })
  .catch((error) => {
    console.error('\n❌ Database setup failed:', error.message);
    console.error('\n🔧 Please check your database connection settings in .env file');
    process.exit(1);
  });