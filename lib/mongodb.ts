import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI || 'mongodb://localhost:27017/webtoon_studio';

if (!MONGODB_URI) {
  throw new Error('Please define the MONGODB_URI environment variable inside .env.example');
}

interface CachedMongoose {
  conn: typeof mongoose | null;
  promise: Promise<typeof mongoose> | null;
}

declare global {
  var mongooseCached: CachedMongoose | undefined;
}

let cached: CachedMongoose = global.mongooseCached || { conn: null, promise: null };

if (!global.mongooseCached) {
  global.mongooseCached = cached;
}

export async function connectDB() {
  if (cached.conn) {
    return cached.conn;
  }

  if (!cached.promise) {
    const opts = {
      bufferCommands: false,
    };

    cached.promise = mongoose.connect(MONGODB_URI, opts).then((mongooseInstance) => {
      return mongooseInstance;
    }).catch((err) => {
      console.warn('MongoDB connection warning (falling back to mock storage if needed):', err.message);
      throw err;
    });
  }

  try {
    cached.conn = await cached.promise;
  } catch (e) {
    cached.promise = null;
    throw e;
  }

  return cached.conn;
}
