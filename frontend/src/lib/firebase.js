import { initializeApp, getApps, getApp } from "firebase/app";
import { getAuth } from "firebase/auth";

import { firebaseConfig } from "./firebase-config";
export { firebaseConfig } from "./firebase-config";
export const firebaseConfigured = [firebaseConfig.apiKey, firebaseConfig.projectId, firebaseConfig.messagingSenderId, firebaseConfig.appId].every(value => !!value?.trim());
export const app = firebaseConfigured ? (getApps().some(a => a.name === "[DEFAULT]") ? getApp() : initializeApp(firebaseConfig)) : null;
export const auth = app ? getAuth(app) : null;
// Existing shop login remains JWT-based; this auth export is available for
// future Firebase Auth features, not used as an alternative shop permission.
