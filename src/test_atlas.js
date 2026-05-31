const mongoose = require('mongoose');

const uri = 'mongodb+srv://kunal:KunalSecurePass2026@cluster0.lwdxi.mongodb.net/lms_production_db?retryWrites=true&w=majority';

async function testConnection() {
  console.log('Testing connection to MongoDB Atlas...');
  try {
    await mongoose.connect(uri);
    console.log('SUCCESS: Successfully connected to MongoDB Atlas!');
    await mongoose.connection.close();
  } catch (error) {
    console.error('FAILED: Could not connect to Atlas.');
    console.error('Error message:', error.message);
  }
}

testConnection();
