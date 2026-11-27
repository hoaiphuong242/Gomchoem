import { cert, getApps, initializeApp } from "firebase-admin/app";
import { getAuth } from "firebase-admin/auth";
import { getFirestore } from "firebase-admin/firestore";
import { getMessaging } from "firebase-admin/messaging";
import { createPrivateKey } from "node:crypto";

export function firebaseAdminReady() {
  if (!["FIREBASE_PROJECT_ID", "FIREBASE_CLIENT_EMAIL", "FIREBASE_PRIVATE_KEY"].every(key => !!process.env[key]?.trim())) return false;
  try { return createPrivateKey(process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n")).asymmetricKeyType === "rsa"; }
  catch { return false; }
}
// Lazy init: missing credentials must not break orders, builds or in-app alerts.
export function getAdminApp() {
  const existing = getApps().find(app => app.name === "gomchoem");
  if (existing) return existing;
  if (!firebaseAdminReady()) throw new Error("Chưa cấu hình Firebase Admin");
  return initializeApp({ credential: cert({ projectId: process.env.FIREBASE_PROJECT_ID!.trim(), clientEmail: process.env.FIREBASE_CLIENT_EMAIL!.trim(), privateKey: process.env.FIREBASE_PRIVATE_KEY!.replace(/\\n/g, "\n") }) }, "gomchoem");
}
export const adminAuth = () => getAuth(getAdminApp());
export const adminDb = () => getFirestore(getAdminApp());
export const adminMessaging = () => getMessaging(getAdminApp());
// Firestore is available if needed; shop data/notifications stay in PostgreSQL.
