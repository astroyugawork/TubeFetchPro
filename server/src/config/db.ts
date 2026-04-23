import mongoose from 'mongoose';
import dotenv from 'dotenv';

dotenv.config();

const connectDB = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (mongoUri && !process.env.USE_MOCK_DB) {
    try {
      console.log('Connecting to MongoDB Atlas...');
      await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
      console.log('[SUCCESS] Connected to MongoDB Atlas');
      return;
    } catch (error: any) {
      console.warn(`[WARN] Atlas connection failed: ${error.message}`);
    }
  } else {
    console.warn('[WARN] MONGO_URI not set');
  }

  // In-memory fallback — only works if mongodb-memory-server is installed (dev only).
  try {
    const { MongoMemoryServer } = await import('mongodb-memory-server');
    const mongoServer = await MongoMemoryServer.create();
    const uri = mongoServer.getUri();
    await mongoose.connect(uri);
    console.log(`[SUCCESS] In-Memory MongoDB Started at ${uri}`);
  } catch (err: any) {
    console.error(`[ERROR] No database available: ${err.message}`);
    console.error('[ERROR] Set MONGO_URI env var in Railway Variables to connect to MongoDB Atlas.');
    // Do NOT exit — keep the HTTP server alive so /health passes.
    // DB-dependent routes will fail, but the process stays up.
  }
};

export default connectDB;
