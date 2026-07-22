/* ==========================================================================
   FIREBASE CONFIGURATION — fill this in with YOUR project's values
   ==========================================================================
   Where to find these:
     Firebase Console → (your project) → Project settings (gear icon)
     → General tab → "Your apps" → Web app → SDK setup and configuration
     → select "Config"

   See SETUP-GUIDE.md, Step 2, for the full walkthrough.
   ========================================================================== */

const firebaseConfig = {
  apiKey: "REPLACE_WITH_YOUR_API_KEY",
  authDomain: "REPLACE_WITH_YOUR_PROJECT.firebaseapp.com",
  projectId: "REPLACE_WITH_YOUR_PROJECT_ID",
  storageBucket: "REPLACE_WITH_YOUR_PROJECT.firebasestorage.app",
  messagingSenderId: "REPLACE_WITH_YOUR_SENDER_ID",
  appId: "REPLACE_WITH_YOUR_APP_ID"
};

/* Google Cloud OAuth 2.0 Client ID — powers the "Backup to Google Drive"
   button in the admin panel only. Not required for the app to otherwise work.
   Create it in: Google Cloud Console → APIs & Services → Credentials
   → Create Credentials → OAuth client ID → Web application
   See SETUP-GUIDE.md, Step 5. */
const GOOGLE_OAUTH_CLIENT_ID = "REPLACE_WITH_YOUR_OAUTH_CLIENT_ID.apps.googleusercontent.com";

/* Society identity — used in page titles, receipts and the audit log. */
const SOCIETY = {
  shortName: "MHMRWS",
  fullName: "Max Heights Majestic Resident Welfare Society",
  logo: "assets/logo-mark.png"
};

/* --------------------------------------------------------------------------
   Firebase SDK init (modular v12, loaded straight from Google's CDN —
   no build step needed). Every page imports { auth, db, storage } from here.
   -------------------------------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-app.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.16.0/firebase-storage.js";

export const app = initializeApp(firebaseConfig);
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { GOOGLE_OAUTH_CLIENT_ID, SOCIETY, firebaseConfig };

setPersistence(auth, browserLocalPersistence).catch(() => {/* falls back to session persistence silently */});

export const CONFIG_IS_PLACEHOLDER = firebaseConfig.apiKey === "REPLACE_WITH_YOUR_API_KEY";
