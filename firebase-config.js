// Test-only stub for firebase-config.js — app-common.js only needs `db` to
// exist as *something* passable to the Firestore function stubs below; it
// never inspects db's shape directly.
export const db = { __stub: 'db' };
export const auth = { __stub: 'auth' };
export const storage = { __stub: 'storage' };
export const SOCIETY = { shortName: 'MHMRWS', fullName: 'Max Heights Majestic RWS', regNumber: 'TEST' };
export const GOOGLE_OAUTH_CLIENT_ID = 'test';
export const firebaseConfig = { apiKey: 'test' };
export const APP_CHECK_ENABLED = false;
export const CONFIG_IS_PLACEHOLDER = false;
