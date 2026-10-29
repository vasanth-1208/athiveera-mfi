import mongoose from 'mongoose';
import { MongoMemoryServer } from 'mongodb-memory-server';
import { ENV } from './env';

let mongod: MongoMemoryServer | null = null;

export async function connectDB(): Promise<void> {
  try {
    let uri = ENV.MONGODB_URI;

    if (!uri) {
      console.log('No MONGODB_URI provided in environment. Initializing MongoMemoryServer for development/testing...');
      mongod = await MongoMemoryServer.create();
      uri = mongod.getUri();
      console.log(`MongoMemoryServer running at: ${uri}`);
    } else {
      if (uri && uri.endsWith('/')) {
      uri = `${uri}athiveera_mfi?retryWrites=true&w=majority`;
    }
    console.log(`Connecting to MongoDB at: ${uri.replace(/\/\/[^:]+:[^@]+@/, '//***:***@')}`);
    }

    await mongoose.connect(uri);
    console.log('MongoDB connected successfully.');
  } catch (error) {
    console.error('MongoDB connection error:', error);
    process.exit(1);
  }
}

export async function disconnectDB(): Promise<void> {
  try {
    await mongoose.disconnect();
    if (mongod) {
      await mongod.stop();
    }
    console.log('MongoDB disconnected.');
  } catch (error) {
    console.error('Error disconnecting MongoDB:', error);
  }
}
