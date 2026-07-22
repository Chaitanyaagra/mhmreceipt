# MHMRWS Digital Portal — Setup Guide

Yeh guide aapko step-by-step batayega ki portal ko Firebase se connect karke, GitHub par host karke, aur Google Drive backup enable karke live kaise karein. Kahin bhi stuck ho jaayein, is guide ko wapas khol kar us step se continue kar sakte hain.

## 📦 Is package mein kya hai

```
index.html                    Resident portal — registration, login, payment, receipts
admin.html                    Admin panel — approvals, verification, reports, settings
verify.html                   Public page jahan har receipt ka QR code le jaata hai
styles.css                    Shared design system (colors, fonts, components)
firebase-config.js            Aapki Firebase project ki settings (ise edit karna hai)
app-common.js                 Shared logic — IDs, receipts, Excel, encryption, Drive backup
firestore.rules               Database security rules
storage.rules                 File-upload security rules
manifest.json + sw.js         PWA support (home screen par install ho sakta hai)
assets/                       Aapka logo + generated app icons
.github/workflows/deploy.yml  GitHub push par auto-deploy to GitHub Pages
```

**Koi build step nahi hai.** Yeh plain HTML/CSS/JS hai — seedha browser mein khulega, chahe local file se ho ya GitHub Pages se.

---

## ✅ Is version mein kya-kya fully kaam karta hai

- Resident registration + admin approval, with a permanent `MHM-YYYY-NNNNNN` Member ID
- Cash/Cheque (office) aur UPI/Net Banking (online) dono payment modes, duplicate-submission protection ke saath
- Payment verification → automatic sequential Receipt Number (`MHMRWS-YYYY-NNNNNN`), race-condition-safe
- QR-verified PDF receipts (`verify.html` se koi bhi check kar sakta hai)
- Notice board (English + Hindi), Committee directory
- Search/filter, Financial Year selector, charts, Excel export
- Bulk Excel import (dry-run validation) aur bulk ZIP document export
- Role-based Admin Panel (Super Admin / President / Vice President / Secretary / Joint Secretary / Treasurer)
- Immutable Audit Log (kaun, kya, kab, kis IP se)
- Deactivate Member (soft delete — history kabhi delete nahi hoti)
- One-click Google Drive backup
- Optional AES-256 encryption layer for Aadhaar/PAN uploads
- PWA install support + GitHub Pages auto-deploy

## ⚠️ Kya simplify kiya gaya hai (aur kyun)

Aapki original spec ek poora Node.js + MySQL + WhatsApp Business API server maangti thi. Ek single `index.html` app — jaisa aapne is baar maanga — fundamentally ek **static site + Firebase** architecture hai, jisme apna server nahi hota. Isliye kuch cheezein simplify ki gayi hain:

| Feature | Is version mein | Upgrade path |
|---|---|---|
| WhatsApp automated bot (inbound webhook) | Manual "wa.me" reminder links (Admin ek click mein WhatsApp kholta hai) | WhatsApp Business API ke liye Meta Business verification + ek chhota backend chahiye hoga |
| Server cron jobs (har 2 ghante backup, 24-hr SLA alerts) | Manual "Backup Now" button | GitHub Actions se scheduled workflow bana sakte hain (bata sakta hoon agar chahiye) |
| SMS OTP / MFA for Admin | Email + password login | Firebase Phone Auth ke liye **Blaze (pay-as-you-go) plan** chahiye — Spark (free) plan par SMS bilkul included nahi hai |
| A4 / Half-A4 / Thermal receipt formats alag-alag | Ek hi print-friendly receipt — browser ke Print dialog se koi bhi paper size choose kar sakte hain | Agar 3 fixed hardcoded layouts chahiye, bata dijiye |

Yeh sab honest trade-offs hain, chhupaye nahi gaye — jahan zaroori laga wahan comments bhi likhe hain code mein.

---

## Step 1 — Firebase Project Banayein

1. [console.firebase.google.com](https://console.firebase.google.com) par jaayein → **Add project**
2. Project ka naam dein (e.g. `mhmrws-portal`) → continue
3. Google Analytics optional hai, skip kar sakte hain

### Web App Register Karein
1. Project Overview par **Web icon (`</>`)** click karein
2. App nickname dein (e.g. "MHMRWS Web") → **Register app**
3. Jo `firebaseConfig` object dikhega, usse copy kar lein — agle step mein chahiye hoga

### Zaroori Services Enable Karein
Left sidebar se:
- **Authentication** → Get Started → Sign-in method → **Email/Password** ko Enable karein
- **Firestore Database** → Create database → Production mode → apne region ke closest location choose karein (e.g. `asia-south1` Mumbai)
- **Storage** → Get Started → Production mode

---

## Step 2 — Config File Update Karein

`firebase-config.js` file kholein aur `firebaseConfig` object ki values apne actual project ki values se replace karein:

```js
const firebaseConfig = {
  apiKey: "AIzaSy...",
  authDomain: "mhmrws-portal.firebaseapp.com",
  projectId: "mhmrws-portal",
  storageBucket: "mhmrws-portal.firebasestorage.app",
  messagingSenderId: "123456789",
  appId: "1:123456789:web:abc123"
};
```

---

## Step 3 — Security Rules Deploy Karein

**Option A — Firebase Console se (sabse aasaan):**
1. Firestore Database → **Rules** tab → `firestore.rules` file ka poora content paste karein → **Publish**
2. Storage → **Rules** tab → `storage.rules` file ka poora content paste karein → **Publish**

**Option B — Firebase CLI se:**
```bash
npm install -g firebase-tools
firebase login
firebase init          # Firestore + Storage select karein, existing rules files point karein
firebase deploy --only firestore:rules,storage
```

> Agar Storage rules deploy karte waqt `firestore.exists()` error aaye, toh `storage.rules` file ke bottom mein diya gaya fallback note dekhein.

---

## Step 4 — Pehla Super Admin Account Banayein

Yeh ek-baar ka manual step hai (chicken-and-egg problem — admin panel khud admin nahi bana sakta jab tak ek admin exist na kare):

1. Firebase Console → Authentication → Users → **Add user** → apna email + password dein → note kar lein **User UID**
2. Firestore Database → Start collection → Collection ID: `admins`
3. Document ID mein wahi **User UID** paste karein jo abhi copy kiya
4. Fields add karein:
   - `uid` (string) → wahi UID
   - `name` (string) → aapka naam
   - `email` (string) → wahi email
   - `role` (string) → `superadmin`
5. Save karein

Ab `admin.html` par isi email/password se login kar sakte hain — yahan se aage sab admins aap Admin Panel ke andar se bana sakte hain.

---

## Step 5 — Google Drive Backup Setup (Optional par recommended)

1. [console.cloud.google.com](https://console.cloud.google.com) par jaayein, apna Firebase project hi yahan select karein (Firebase projects Google Cloud projects hi hote hain)
2. **APIs & Services → Library** → "Google Drive API" search karke **Enable** karein
3. **APIs & Services → Credentials → Create Credentials → OAuth client ID**
   - Agar pehli baar hai, "Configure Consent Screen" maangega — External choose karein, app name/email bhar dein, save karein
   - Application type: **Web application**
   - Authorized JavaScript origins mein apna live URL add karein, e.g.:
     - `https://yourusername.github.io` (GitHub Pages ke liye)
     - `http://localhost:5500` (agar local testing bhi karni ho)
4. Jo **Client ID** milega (kuch aisa dikhega: `123-abc.apps.googleusercontent.com`), usse `firebase-config.js` mein `GOOGLE_OAUTH_CLIENT_ID` mein paste kar dein

Admin Panel → Settings → **Backup Now** button ab kaam karega. Pehli baar click karne par Google ek consent popup dikhayega — accept karte hi backup `MHMRWS/Database/` folder mein us Google account ke Drive par ho jayega jisne backup click kiya (society ka koi shared/dedicated Google account use karna best rahega, taaki backups ek hi jagah collect hon).

---

## Step 6 — GitHub Par Push Aur Live Karein

```bash
git init
git add .
git commit -m "Initial commit — MHMRWS Digital Portal"
git branch -M main
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO.git
git push -u origin main
```

Phir GitHub par:
1. Apni repo → **Settings → Pages**
2. Source: **GitHub Actions** select karein (kyunki `.github/workflows/deploy.yml` already included hai)
3. Push karte hi Actions tab mein deploy chalega, aur kuch minute mein site live ho jaayegi: `https://YOUR_USERNAME.github.io/YOUR_REPO/`

> **Important:** yeh live URL milte hi Step 5 mein wapas jaakar OAuth "Authorized JavaScript origins" mein isse add karna na bhoolein, warna Drive Backup button error dega.

Aur Firebase Console → Authentication → Settings → **Authorized domains** mein bhi yahi GitHub Pages domain add karein, warna login/register error dega.

---

## Step 7 — Test Karein

1. Live URL kholein → registration form bharein (test email se)
2. `admin.html` par apne Super Admin se login karein → Members mein registration approve karein
3. Wapas resident dashboard mein login karke ek test payment submit karein
4. Admin panel se verify karein → resident dashboard se receipt download karein → us PDF ke QR ko scan karke `verify.html` par confirm karein

---

## 🔒 Security Notes

- **Aadhaar/PAN documents** hamesha Storage Rules se protected hain (sirf resident khud + Admins access kar sakte hain) — yeh chahe aap encryption use karein ya nahi, hamesha ON hai.
- **Optional encryption layer** (Settings → Document Security): ek extra AES-256 layer hai. Iska passphrase kabhi bhi database/code mein store nahi hota — sirf aapke committee ko yaad rakhna hai. Passphrase bhool gaye toh woh specific documents access nahi ho sakte, isliye ise password manager ya locked register mein likh kar rakhein.
- **Har admin action** — approve, reject, verify, delete, settings change — Audit Log mein permanently record hota hai, IP address ke saath.

## 🎨 Customization

- Colors: `styles.css` ke top mein `:root { --navy-950: ...; --saffron-500: ...; }` — yahin se poori site ka theme change ho jaata hai.
- Logo: `assets/logo-mark.png` ko replace kar dein (aur `assets/icon-192.png` / `icon-512.png` bhi resize karke replace kar dein for best PWA quality — abhi wale aapki upload ki hui image se hi generate kiye gaye hain).
- Society details (address, phone, bank details): yeh sab database mein hain, code mein nahi — Admin Panel → Settings se hi update karein.

## 🆘 Common Errors

| Error | Wajah |
|---|---|
| "Firebase: Error (auth/unauthorized-domain)" | Aapka live URL Firebase Authorized Domains mein add nahi hai (Step 6 ka aakhri note dekhein) |
| "Missing or insufficient permissions" | Firestore rules deploy nahi hui, ya admin doc ka field/role galat hai |
| "The query requires an index" | Firestore khud ek link dega console mein — usko click karke index auto-create ho jaata hai |
| Drive Backup button error | `GOOGLE_OAUTH_CLIENT_ID` placeholder hi reh gaya hai, ya current URL Authorized Origins mein add nahi hai |

Kisi bhi step mein stuck ho jaayein toh yeh guide + error message dono share karke wapas pooch sakte hain.
