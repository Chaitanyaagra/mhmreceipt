/* ==========================================================================
   FIREBASE CONFIGURATION — fill this in with YOUR project's values
   ==========================================================================
   Where to find these:
     Firebase Console → (your project) → Project settings (gear icon)
     → General tab → "Your apps" → Web app → SDK setup and configuration
     → select "Config"

   See SETUP-GUIDE.md, Step 2, for the full walkthrough.
   ========================================================================== */

/* The apiKey below is NOT a secret — Firebase web keys are public by design and
   the security rules are what protect your data. It is still worth restricting:
   Google Cloud Console -> APIs & Services -> Credentials -> this key ->
   "Application restrictions" -> Websites -> add only your Pages domain. That
   stops somebody else's app from being billed to your project. */
const firebaseConfig = {
  apiKey: "AIzaSyAoPrgFpUlkjSfnF0560RXkusqAY65ysXY",
  authDomain: "mhm-portal.firebaseapp.com",
  projectId: "mhm-portal",
  storageBucket: "mhm-portal.firebasestorage.app",
  messagingSenderId: "801279298623",
  appId: "1:801279298623:web:efeb6532e3c2cd0826fc8a",
  measurementId: "G-1NT550H0DN" // not used yet — kept here in case you wire up Firebase Analytics later
};

/* Google Cloud OAuth 2.0 Client ID — powers the "Backup to Google Drive"
   button in the admin panel only. Not required for the app to otherwise work.
   Create it in: Google Cloud Console → APIs & Services → Credentials
   → Create Credentials → OAuth client ID → Web application
   See SETUP-GUIDE.md, Step 5. */
const GOOGLE_OAUTH_CLIENT_ID = "801279298623-hulscgf3756i0arebt5ql48fv6mrsj8q.apps.googleusercontent.com";

/* Society identity — used in page titles, receipts and the audit log. */
const SOCIETY = {
  shortName: "MHMRWS",
  fullName: "Max Heights Majestic Resident Welfare Society",
  regNumber: "COOP/2026/JAIPUR/502531",
  logo: "logo-data.js"   // the seal is embedded as base64 — see logo-data.js
};

/* --------------------------------------------------------------------------
   Firebase SDK init (modular v12, loaded straight from Google's CDN —
   no build step needed). Every page imports { auth, db, storage } from here.
   -------------------------------------------------------------------------- */
import { initializeApp } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app.js";
import { initializeAppCheck, ReCaptchaEnterpriseProvider } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-app-check.js";
import { getAuth, setPersistence, browserLocalPersistence } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";
import { getStorage } from "https://www.gstatic.com/firebasejs/12.18.0/firebase-storage.js";

export const app = initializeApp(firebaseConfig);

/* --------------------------------------------------------------------------
   APP CHECK — please turn this on.

   Security rules answer "is this user allowed to do that". They cannot answer
   "is this request even coming from our app". Without App Check, anyone can
   talk to this Firebase project directly from a script: create accounts by the
   thousand, hammer the public collections, and run up the bill on a society
   that budgets in four figures. The rules would hold — but you would be paying
   for every rejected request.

   Uses reCAPTCHA ENTERPRISE, not classic reCAPTCHA v3 — Firebase Console's own
   App Check screen now issues Enterprise keys by default for new projects, and
   an Enterprise key pasted into v3's provider class silently fails, so this
   must match whichever the Console actually gave you.

   To enable (about half an hour; free up to 10,000 assessments/month, which is
   far more than a single-society portal will ever use):
     1. Google Cloud Console -> Security -> reCAPTCHA Enterprise -> Create key.
        Choose "Website", add this site's domain(s) to the allow-list. This
        needs a Cloud Billing account linked to the project (still $0 unless
        you go over the free 10,000/month — Firebase itself doesn't require
        one, reCAPTCHA Enterprise specifically does).
     2. Firebase Console -> App Check -> register the web app -> reCAPTCHA
        Enterprise -> it should find the key from step 1 in the same project.
     3. Paste that key ID (the public one, safe to commit) below.
     4. Watch Firebase Console -> App Check -> Metrics for a few days. Once
        nearly all traffic shows as verified, click Enforce on Firestore,
        Storage and Authentication.

   Leaving the placeholder in place is safe: App Check simply stays off and the
   portal behaves exactly as before.
   -------------------------------------------------------------------------- */
export const RECAPTCHA_ENTERPRISE_SITE_KEY = "REPLACE_WITH_YOUR_RECAPTCHA_ENTERPRISE_SITE_KEY";

export const APP_CHECK_ENABLED = !RECAPTCHA_ENTERPRISE_SITE_KEY.startsWith("REPLACE_WITH");
if (APP_CHECK_ENABLED) {
  try {
    initializeAppCheck(app, {
      provider: new ReCaptchaEnterpriseProvider(RECAPTCHA_ENTERPRISE_SITE_KEY),
      isTokenAutoRefreshEnabled: true
    });
  } catch (e) {
    console.warn('App Check could not start; continuing without it.', e);
  }
} else {
  console.warn('App Check is not configured — see the note in firebase-config.js.');
}
export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);
export { GOOGLE_OAUTH_CLIENT_ID, SOCIETY, firebaseConfig };

setPersistence(auth, browserLocalPersistence).catch(() => {/* falls back to session persistence silently */});

export const CONFIG_IS_PLACEHOLDER = firebaseConfig.apiKey === "REPLACE_WITH_YOUR_API_KEY";
