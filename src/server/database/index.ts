import mongoose, { type Mongoose } from 'mongoose';
import {
  COMPLETE_DATABASE_URL,
  DATABASE_NAME,
  DATABASE_PASS,
  DATABASE_URL,
  DATABASE_USER,
} from '../constants.ts';

let connection: Mongoose;

export async function connectDB() {
  try {
    console.info(`MongoDB connecting to: ${DATABASE_URL}`);
    console.log(`Connecting to MongoDB...`);
    connection = await mongoose.connect(COMPLETE_DATABASE_URL, {
      auth: {
        password: DATABASE_PASS,
        username: DATABASE_USER,
      },
      dbName: DATABASE_NAME,
    });
    console.log('Connected to MongoDB!');
    console.log();
  } catch (e) {
    console.error('Failed to connect to MongoDB!');
    throw e;
  }
}

export async function disconnectDB() {
  console.log('Disconnecting from MongoDB...');
  await connection.disconnect();
  console.log('Disconnected from MongoDB!');
}
