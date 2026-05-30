import mongoose from 'mongoose';

const redactUri = (uri: string): string => {
  return uri.replace(/:([^:@]+)@/, ':******@');
};

export const connectDB = async (uri: string = 'mongodb://127.0.0.1:27017/lms_db'): Promise<void> => {
  const safeUri = redactUri(uri);
  try {
    mongoose.set('strictQuery', true);

    await mongoose.connect(uri, {
      autoIndex: true, // Crucial for unique indexes like PAN and UTR
    });

    console.log(`[MongoDB] Connected successfully to the Loan Management Database: ${safeUri}`);
  } catch (error: any) {
    console.error(`[MongoDB] Connection failed for ${safeUri}: ${error.message}`);
    console.warn(`⚠️ [MongoDB Warning] Express server will continue running, but database operations will fail until MONGO_URI is configured correctly.`);
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
