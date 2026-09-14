import mongoose from 'mongoose';

export type MongoConnectionState = 'connected' | 'disconnected' | 'connecting';

interface ConnectionInfo {
  state: MongoConnectionState;
  uri: string;
  error?: string;
  lastConnectedAt?: Date;
}

const connectionInfo: ConnectionInfo = {
  state: 'connecting',
  uri: process.env.MONGODB_URI,
};

export async function initMongoDB(): Promise<ConnectionInfo> {
  const uri = process.env.MONGODB_URI;
  return connectMongoDB(uri);
}

export async function connectMongoDB(uriString?: string): Promise<ConnectionInfo> {
  const uri = uriString || process.env.MONGODB_URI;
  connectionInfo.uri = uri;
  connectionInfo.state = 'connecting';
  connectionInfo.error = undefined;

  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.disconnect();
    }

    // Connect with a 5-second timeout
    await mongoose.connect(uri, {
      serverSelectionTimeoutMS: 5000,
      connectTimeoutMS: 5000,
    });

    connectionInfo.state = 'connected';
    connectionInfo.lastConnectedAt = new Date();
    connectionInfo.error = undefined;
    console.log(`[Suwayomi MongoDB] Successfully connected to MongoDB at ${uri}`);
    return connectionInfo;
  } catch (err: any) {
    connectionInfo.state = 'disconnected';
    connectionInfo.error = err.message || 'Could not connect to MongoDB.';
    console.warn(`[Suwayomi MongoDB] Connection warning: ${connectionInfo.error}`);
    return connectionInfo;
  }
}

export function getMongoConnectionInfo(): ConnectionInfo {
  return {
    ...connectionInfo,
    state: mongoose.connection.readyState === 1 ? 'connected' : connectionInfo.state,
  };
}

export function isMongoActive(): boolean {
  return mongoose.connection.readyState === 1;
}
