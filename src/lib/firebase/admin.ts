import { cert, getApps, initializeApp, type App } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";

// Server-side Firebase Admin. Initialized once and reused — getApps() guards
// against re-init across hot reloads and serverless warm invocations.
//
// Credentials come from a service account, split into three env vars so they
// fit Vercel's UI without uploading a JSON file. The private key has its
// newlines escaped as "\n" in the env value, so we unescape them here.
function adminApp(): App {
  const existing = getApps();
  if (existing.length) return existing[0];

  return initializeApp({
    credential: cert({
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, "\n"),
    }),
  });
}

export const adminAuth = () => getAuth(adminApp());
