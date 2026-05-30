import mongoose from 'mongoose';

export const connectDB = async (uri: string = 'mongodb://127.0.0.1:27017/lms_db'): Promise<void> => {
  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(uri, {
      autoIndex: true, // Crucial for unique indexes like PAN and UTR
    });

    console.log(`[MongoDB] Connected successfully to the Loan Management Database: ${uri}`);
  } catch (error: any) {
    console.error(`[MongoDB] Connection failed: ${error.message}`);
    process.exit(1);
  }
};

export const disconnectDB = async (): Promise<void> => {
  try {
    await mongoose.connection.close();
    console.log('[MongoDB] Connection closed successfully.');
  } catch (error: any) {
    console.error(`[MongoDB] Failed to close connection: ${error.message}`);
  }
};
