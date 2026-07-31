import mongoose, { type Mongoose } from 'mongoose';

import { env } from 'server/config/env.ts';

let connection: Mongoose;

export async function connectDB() {
  try {
    console.info(`MongoDB connecting to: ${env.DATABASE_URL}`);
    console.log(`Connecting to MongoDB...`);
    connection = await mongoose.connect(env.DATABASE_URL, {
      auth: {
        password: env.DATABASE_PASS,
        username: env.DATABASE_USER,
      },
      dbName: env.DATABASE_NAME,
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
