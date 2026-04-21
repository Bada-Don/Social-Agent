import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Explicitly load .env from the app root
dotenv.config({ path: path.resolve(__dirname, '../../.env') });

import * as admin from 'firebase-admin';
import { z } from 'zod';

// Validating environment variables at startup
const envSchema = z.object({
  FIREBASE_PROJECT_ID: z.string(),
  FIREBASE_CLIENT_EMAIL: z.string(),
  FIREBASE_PRIVATE_KEY: z.string(),
});

// In a real production environment, process.env would be loaded.
// Here we use safeParse or parse. For initial setup, we assume they will be provided.
const env = envSchema.parse(process.env);

if (!admin.apps.length) {
  admin.initializeApp({
    credential: admin.credential.cert({
      projectId: env.FIREBASE_PROJECT_ID,
      clientEmail: env.FIREBASE_CLIENT_EMAIL,
      // Replace literal \n with actual newlines in private key
      privateKey: env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n'),
    }),
  });
}

export const db = admin.firestore();
export const auth = admin.auth();
export const storage = admin.storage();

// Strongly typed collection references
export const collections = {
  users: db.collection('users'),
  // Helper to get subcollections safely
  messages: (uid: string) => db.collection(`users/${uid}/messages`),
  emails: (uid: string) => db.collection(`users/${uid}/emails`),
  tasks: (uid: string) => db.collection(`users/${uid}/tasks`),
  memory: (uid: string) => db.collection(`users/${uid}/memory`),
  digests: (uid: string) => db.collection(`users/${uid}/digests`),
};
