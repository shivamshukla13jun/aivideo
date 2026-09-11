import mongoose from 'mongoose';
import { config } from '../config';

let isConnected = false;

export async function connectDB(): Promise<typeof mongoose | null> {
  if (isConnected && mongoose.connection.readyState === 1) {
    return mongoose;
  }

  const uri = config.mongoUri || 'mongodb://127.0.0.1:27017/aivideo';

  try {
    const conn = await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
    });

    isConnected = true;
    console.log(`[MongoDB] Connected successfully to database: ${conn.connection.name} (${conn.connection.host})`);

    mongoose.connection.on('error', (err) => {
      console.error('[MongoDB] Connection error:', err);
      isConnected = false;
    });

    mongoose.connection.on('disconnected', () => {
      console.warn('[MongoDB] Disconnected from database.');
      isConnected = false;
    });

    return conn;
  } catch (err: any) {
    console.warn(`[MongoDB] Failed to connect to ${uri}: ${err.message}. Will use filesystem cache fallback.`);
    isConnected = false;
    return null;
  }
}

export function isDBConnected(): boolean {
  return isConnected && mongoose.connection.readyState === 1;
}
