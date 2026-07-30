/* ==========================================================================
   MHMRWS Portal — shared application logic
   Imported by index.html, admin.html and verify.html.
   Requires (loaded as classic <script> tags before this module runs):
     jsPDF, qrcode.js, SheetJS (XLSX), JSZip  — see each HTML file's <head>
   ========================================================================== */

import { db } from './firebase-config.js';
import { TOWER_PLAN, isValidFlat } from './tower-plan.js';
import { AVATAR_PLACEHOLDER } from './avatar-placeholder.js';
import {
  doc, getDoc, setDoc, addDoc, collection, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

/* ---------------------------------------------------------------------- */
/*  Toasts                                                                 */
/* ---------------------------------------------------------------------- */
/* The live region has to already be in the document when a message is
   inserted into it. Creating the container and the toast in the same tick —
   which is what happened before — means assistive technology frequently never
   announces the first one, and the first one is usually the important one
   ("verify your email before paying"). So the region is created at load. */
function ensureToastRegion() {
  let region = document.getElementById('toast-region');
  if (region) return region;
  region = document.createElement('div');
  region.id = 'toast-region';
  region.setAttribute('role', 'status');
  region.setAttribute('aria-live', 'polite');
  region.setAttribute('aria-atomic', 'false');
  document.body.appendChild(region);
  return region;
}

if (typeof document !== 'undefined') {
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', ensureToastRegion, { once: true });
  } else {
    ensureToastRegion();
  }
}

export { installModalA11y, installOfflineBanner, isOffline } from './ui-a11y.js';

export function showToast(message, type = 'info') {
  const region = ensureToastRegion();
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  // No role here: the region above already announces its own changes, and
  // role="status" on both makes some screen readers read the message twice.
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => {
    // Class-based so the exit direction can differ between desktop (top-right,
    // leaves upward) and mobile (bottom, leaves downward) — see styles.css.
    el.classList.add('leaving');
    setTimeout(() => el.remove(), 320);
  }, 4200);
}

/* Tower & flat plan lives in its own dependency-free module so the
   registration form can use it without pulling in the Firebase SDK.
   Re-exported here so existing imports keep working. */
export { TOWER_PLAN, TOWER_IDS, floorLabel, flatsForTower, isValidFlat, totalFlats } from './tower-plan.js';

/* ---------------------------------------------------------------------- */
/*  Validation                                                             */
/*                                                                          */
/*  These mirror the limits in firestore.rules exactly. The rules are what  */
/*  actually protect the ledger — a determined user can bypass anything on  */
/*  this side. These exist so people get a clear, immediate message instead */
/*  of a cryptic permission error. If you change a limit here, change it in */
/*  firestore.rules too, or writes will start failing with no explanation.  */
/* ---------------------------------------------------------------------- */
export const LIMITS = {
  amountMin: 1,
  amountMax: 1000000,      // matches isValidAmount() in firestore.rules
  nameMax: 100,
  towerMax: 50,
  flatMax: 30,
  addressMax: 500,
  utrMin: 6,
  utrMax: 22
};

export const PAYMENT_MODES = ['cash', 'cheque', 'upi', 'netbanking'];

/**
 * Validates a payment before submission.
 * @returns {string|null} an error message, or null when the payment is valid.
 */
export function validatePayment({ amount, mode, utr, isOffline }) {
  const amt = Number(amount);
  if (!Number.isFinite(amt)) return 'Amount ek valid number hona chahiye.';
  if (amt < LIMITS.amountMin) return 'Amount kam se kam ₹1 hona chahiye.';
  if (amt > LIMITS.amountMax) return `Amount ₹${LIMITS.amountMax.toLocaleString('en-IN')} se zyada nahi ho sakta. Itni badi rakam ke liye office se sampark karein.`;
  if (Math.round(amt * 100) !== amt * 100) return 'Amount mein do se zyada decimal nahi ho sakte.';
  if (!PAYMENT_MODES.includes(mode)) return 'Payment mode valid nahi hai.';
  if (!isOffline) {
    const t = String(utr || '').trim();
    if (!t) return 'UTR / Transaction ID zaroori hai.';
    if (!/^[a-zA-Z0-9]+$/.test(t)) return 'UTR / Transaction ID mein sirf letters aur numbers ho sakte hain.';
    if (t.length < LIMITS.utrMin || t.length > LIMITS.utrMax)
      return `UTR / Transaction ID ${LIMITS.utrMin}-${LIMITS.utrMax} characters ka hona chahiye.`;
  }
  return null;
}

/**
 * Validates a resident registration. Every field is required — a half-filled
 * member record is worse than none, since the committee then has to chase
 * people for details after the fact.
 * @returns {string|null} an error message, or null when the form is valid.
 */
export function validateRegistration(f) {
  const val = (k) => String(f[k]?.value ?? '').trim();
  const name = val('name');
  const father = val('fatherHusbandName');
  const tower = val('tower');
  const flat = val('flatNumber');
  const mobile = val('mobile');
  const email = val('email');
  const occupation = val('occupation');
  const address = val('address');
  const nomineeName = val('nomineeName');
  const nomineeRelation = val('nomineeRelation');
  const residentType = val('residentType');

  if (!name) return { field: 'name', message: 'Naam zaroori hai.' };
  if (name.length > LIMITS.nameMax) return { field: 'name', message: `Naam ${LIMITS.nameMax} characters se lamba nahi ho sakta.` };
  // \p{M} matters here: Devanagari matras (ा ि ो) are Unicode *Marks*, not
  // Letters, so without it every Hindi name would be rejected.
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(name)) return { field: 'name', message: 'Naam mein sirf akshar, space, aur . \' - ho sakte hain.' };

  if (!father) return { field: 'fatherHusbandName', message: 'Pita / Pati ka naam zaroori hai.' };
  if (father.length > LIMITS.nameMax) return { field: 'fatherHusbandName', message: 'Pita / Pati ka naam bahut lamba hai.' };
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(father)) return { field: 'fatherHusbandName', message: 'Pita / Pati ke naam mein sirf akshar aur space ho sakte hain.' };

  if (!tower) return { field: 'tower', message: 'Tower chunna zaroori hai.' };
  if (!TOWER_PLAN[tower]) return { field: 'tower', message: 'Tower valid nahi hai.' };
  if (!flat) return { field: 'flatNumber', message: 'Flat number chunna zaroori hai.' };
  if (!isValidFlat(tower, flat)) return { field: 'flatNumber', message: `Flat ${flat} Tower ${tower} mein maujood nahi hai.` };

  // Indian mobile numbers begin 6, 7, 8 or 9 — this rejects landlines and
  // the common habit of typing a 0 or +91 prefix into the field.
  if (!/^[0-9]{10}$/.test(mobile)) return { field: 'mobile', message: 'Mobile number theek 10 ankon ka hona chahiye (bina 0 ya +91 ke).' };
  if (!/^[6-9]/.test(mobile)) return { field: 'mobile', message: 'Mobile number 6, 7, 8 ya 9 se shuru hona chahiye.' };

  if (!email) return { field: 'email', message: 'Email zaroori hai.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { field: 'email', message: 'Email address sahi format mein nahi hai.' };

  if (!occupation) return { field: 'occupation', message: 'Occupation zaroori hai.' };
  if (occupation.length > 100) return { field: 'occupation', message: 'Occupation bahut lamba hai.' };
  if (!residentType) return { field: 'residentType', message: 'Owner ya Tenant chunna zaroori hai.' };
  if (!['owner', 'tenant'].includes(residentType)) return { field: 'residentType', message: 'Owner / Tenant valid nahi hai.' };

  if (!address) return { field: 'address', message: 'Address zaroori hai.' };
  if (address.length > LIMITS.addressMax) return { field: 'address', message: 'Address bahut lamba hai.' };

  if (!nomineeName) return { field: 'nomineeName', message: 'Nominee ka naam zaroori hai.' };
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(nomineeName)) return { field: 'nomineeName', message: 'Nominee ke naam mein sirf akshar aur space ho sakte hain.' };
  if (!nomineeRelation) return { field: 'nomineeRelation', message: 'Nominee se sambandh zaroori hai.' };

  if (!f.photo?.files?.length) return { field: 'photo', message: 'Apni photo upload karna zaroori hai.' };
  // Aadhaar / PAN is deliberately NOT required — see the note in index.html.

  if (f.password.value.length < 6) return { field: 'password', message: 'Password kam se kam 6 characters ka hona chahiye.' };
  if (f.password.value !== f.confirmPassword.value) return { field: 'confirmPassword', message: 'Password match nahi kar raha.' };
  if (!f.declaration.checked) return { field: 'declaration', message: 'Aage badhne ke liye declaration par tick karein.' };
  return null;
}

/* ---------------------------------------------------------------------- */
/*  Maintenance dues                                                       */
/*                                                                          */
/*  Without this the portal only knew what had been *received*, never what  */
/*  was *owed* — so a resident who paid ₹100 against a ₹2,400 charge showed */
/*  up as fully paid and vanished from the defaulters list. These helpers    */
/*  turn the committee's configured rate into a real per-flat balance, and   */
/*  partial payments simply add up against it.                              */
/*                                                                          */
/*  Rates live in settings/maintenance and look like:                       */
/*    { rates: { "2026-27": { default: 2400, byTower: { A: 2000 } } } }     */
/*  byTower is optional — towers not listed fall back to default.           */
/* ---------------------------------------------------------------------- */

/** The amount charged to one flat for a financial year. */
export function expectedDue(member, financialYear, maintenanceSettings) {
  const forYear = maintenanceSettings?.rates?.[financialYear];
  if (!forYear) return 0;                       // no rate set = nothing owed yet
  const byTower = forYear.byTower?.[member?.tower];
  const amount = (byTower ?? forYear.default);
  return Number.isFinite(Number(amount)) ? Number(amount) : 0;
}

/** Total verified payments by one member for a financial year. */
export function paidSoFar(payments, memberUid, financialYear) {
  return (payments || [])
    .filter(p => p.memberUid === memberUid
              && p.status === 'verified'
              && p.financialYear === financialYear)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

/**
 * The full dues picture for one member in one financial year.
 * @returns {{expected:number, paid:number, outstanding:number, status:string}}
 *          status is 'no_rate' | 'paid' | 'partial' | 'unpaid' | 'overpaid'
 */
export function duesFor(member, payments, financialYear, maintenanceSettings) {
  const expected = expectedDue(member, financialYear, maintenanceSettings);
  const paid = paidSoFar(payments, member?.uid, financialYear);
  const outstanding = Math.max(0, expected - paid);
  let status;
  if (expected === 0) status = 'no_rate';
  else if (paid === 0) status = 'unpaid';
  else if (paid < expected) status = 'partial';
  else if (paid > expected) status = 'overpaid';
  else status = 'paid';
  return { expected, paid, outstanding, status };
}

/* ---------------------------------------------------------------------- */
/*  One-time membership fee                                                 */
/*                                                                          */
/*  Every member owes a single joining fee (default ₹1100), separate from   */
/*  the yearly maintenance. It is charged once in a member's lifetime, not  */
/*  per financial year, so it can't live in the per-year rate table. The    */
/*  amount is configurable in settings/maintenance as `membershipFee`; a    */
/*  payment counts towards it when its `type` is 'membership'. Older        */
/*  payments have no `type` field and are treated as maintenance, so this   */
/*  change is backward-compatible.                                          */
/* ---------------------------------------------------------------------- */
export const DEFAULT_MEMBERSHIP_FEE = 1100;

/* The society's real bank + office details. Used as the fallback shown to
   residents (payment modal and dashboard) until the committee saves its own
   values in Settings, so a fresh deployment already shows correct information
   rather than "Not configured". The admin form keeps its own copy for
   pre-filling; both hold the same values. */
export const PAYMENT_DEFAULTS = {
  accountName: 'MAX HEIGHTS MAJESTIC RESIDENT WLFR SOC',
  bankName: 'HDFC Bank',
  accountNumber: '50200123261579',
  accountType: 'Current Account',
  ifsc: 'HDFC0003774',
  branch: 'VISHWAKARMA INDUSTRIAL AREA',
  officeAddress: 'Basement, Max Heights Majestic, GH 03 Suncity Township, Sikar Rd, Jaipur, Rajasthan 302048',
  upiId: ''
};

/* Merge saved payment settings over the defaults, so any field the committee
   hasn't filled falls back to the correct society detail. */
export function paymentDetails(saved) {
  return { ...PAYMENT_DEFAULTS, ...(saved || {}) };
}

/** The configured one-time membership fee (falls back to the ₹1100 default). */
export function membershipFeeAmount(maintenanceSettings) {
  const v = maintenanceSettings?.membershipFee;
  return Number.isFinite(Number(v)) ? Number(v) : DEFAULT_MEMBERSHIP_FEE;
}

/** Total verified membership payments a member has made (across all years). */
export function membershipPaid(payments, memberUid) {
  return (payments || [])
    .filter(p => p.memberUid === memberUid
              && p.status === 'verified'
              && p.type === 'membership')
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

/**
 * The membership-fee picture for one member.
 * @returns {{fee:number, paid:number, outstanding:number, cleared:boolean}}
 */
export function membershipDue(member, payments, maintenanceSettings) {
  const fee = membershipFeeAmount(maintenanceSettings);
  const paid = membershipPaid(payments, member?.uid);
  const outstanding = Math.max(0, fee - paid);
  return { fee, paid, outstanding, cleared: outstanding === 0 };
}

export const DUES_LABEL = {
  no_rate:  'Rate not set',
  unpaid:   'Unpaid',
  partial:  'Partially Paid',
  paid:     'Paid',
  overpaid: 'Overpaid'
};

export const DUES_BADGE = {
  no_rate:  'badge-neutral',
  unpaid:   'badge-danger',
  partial:  'badge-warning',
  paid:     'badge-success',
  overpaid: 'badge-info'
};

/* ---------------------------------------------------------------------- */
/*  Expenses                                                               */
/*                                                                          */
/*  The portal could already answer "how much came in". This answers the    */
/*  question residents actually ask at the AGM — "where did it go".         */
/*                                                                          */
/*  Expense records are readable by every resident on purpose: this is the  */
/*  society's own money, and the same figures appear in the audited accounts */
/*  anyway. Committee members should know that vendor names they enter here  */
/*  are visible to members.                                                  */
/* ---------------------------------------------------------------------- */
export const EXPENSE_CATEGORIES = [
  'Security / Guards',
  'Housekeeping',
  'Electricity',
  'Water',
  'Lift AMC',
  'Generator / Diesel',
  'Gardening',
  'Repairs & Maintenance',
  'Office & Admin',
  'Legal / Audit',
  'Festival & Events',
  'Other'
];

export const EXPENSE_MODES = ['cash', 'cheque', 'bank', 'upi'];

/** Totals for one financial year, plus a per-category breakdown. */
export function expenseSummary(expenses, financialYear) {
  const rows = (expenses || []).filter(e => e.financialYear === financialYear);
  const total = rows.reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const byCategory = {};
  rows.forEach(e => {
    const k = e.category || 'Other';
    byCategory[k] = (byCategory[k] || 0) + (Number(e.amount) || 0);
  });

  const categories = Object.entries(byCategory)
    .map(([name, amount]) => ({ name, amount, share: total ? amount / total : 0 }))
    .sort((a, b) => b.amount - a.amount);

  const byMonth = {};
  rows.forEach(e => {
    const d = e.date?.toDate ? e.date.toDate() : (e.date ? new Date(e.date) : null);
    if (!d) return;
    const k = d.toLocaleString('en-IN', { month: 'short', year: '2-digit' });
    byMonth[k] = (byMonth[k] || 0) + (Number(e.amount) || 0);
  });

  return { total, count: rows.length, categories, byMonth };
}

/** Collected vs spent for a financial year — the headline the AGM cares about. */
export function fundPosition(payments, expenses, financialYear) {
  const collected = (payments || [])
    .filter(p => p.status === 'verified' && p.financialYear === financialYear)
    .reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const spent = expenseSummary(expenses, financialYear).total;
  return { collected, spent, balance: collected - spent };
}

/** Validates an expense before it is written. Mirrors the security rules. */
export function validateExpense({ description, amount, category, mode, paidTo }) {
  const amt = Number(amount);
  if (!String(description || '').trim()) return 'Kharche ka vivaran zaroori hai.';
  if (String(description).length > 200) return 'Vivaran bahut lamba hai.';
  if (!Number.isFinite(amt) || amt <= 0) return 'Sahi amount daalein.';
  if (amt > 10000000) return 'Amount ₹1,00,00,000 se zyada nahi ho sakta.';
  if (!EXPENSE_CATEGORIES.includes(category)) return 'Category valid nahi hai.';
  if (!EXPENSE_MODES.includes(mode)) return 'Payment mode valid nahi hai.';
  if (String(paidTo || '').length > 120) return 'Kise diya — yeh naam bahut lamba hai.';
  return null;
}

/* ---------------------------------------------------------------------- */
/*  Formatting                                                             */
/* ---------------------------------------------------------------------- */
export function formatINR(amount) {
  const n = Number(amount) || 0;
  return '₹' + n.toLocaleString('en-IN', { maximumFractionDigits: 0 });
}

export function numberToWordsINR(amount) {
  let num = Math.round(Number(amount) || 0);
  if (num === 0) return 'Zero Rupees Only';
  const ones = ['', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];
  const two = (n) => (n < 20 ? ones[n] : tens[Math.floor(n / 10)] + (n % 10 ? ' ' + ones[n % 10] : ''));
  const three = (n) => (n < 100 ? two(n) : ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 ? ' ' + two(n % 100) : ''));
  const crore = Math.floor(num / 10000000); num %= 10000000;
  const lakh = Math.floor(num / 100000); num %= 100000;
  const thousand = Math.floor(num / 1000); num %= 1000;
  const hundred = num;
  const parts = [];
  if (crore) parts.push(three(crore) + ' Crore');
  if (lakh) parts.push(three(lakh) + ' Lakh');
  if (thousand) parts.push(three(thousand) + ' Thousand');
  if (hundred) parts.push(three(hundred));
  // "One Rupee Only", not "One Rupees Only" — this line is printed on every
  // receipt, so the grammar is worth getting right.
  const unit = (Math.round(Number(amount) || 0) === 1) ? 'Rupee' : 'Rupees';
  return parts.join(' ') + ` ${unit} Only`;
}

export function fmtDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

export function fmtDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' });
}

/* Milliseconds from either a Firestore Timestamp or anything Date can parse,
   for sorting mixed rows without each caller re-checking for .toDate. */
export function tsMillis(ts) {
  if (!ts) return 0;
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const n = d.getTime();
  return Number.isFinite(n) ? n : 0;
}

/* Called once per cell while rendering tables of several hundred rows, so it
   must not allocate a DOM node each time — the old createElement version was
   measurably the slowest thing in renderMembersTable(). */
const HTML_ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
export function escapeHtml(str) {
  return String(str ?? '').replace(/[&<>"']/g, (c) => HTML_ESCAPES[c]);
}

export function debounce(fn, delay = 300) {
  let t;
  return (...args) => { clearTimeout(t); t = setTimeout(() => fn(...args), delay); };
}

/* ---------------------------------------------------------------------- */
/*  Financial year helpers (India: 1 Apr – 31 Mar)                         */
/* ---------------------------------------------------------------------- */
export function currentFinancialYear() {
  const now = new Date();
  const y = now.getFullYear();
  return now.getMonth() >= 3 ? `${y}-${String(y + 1).slice(-2)}` : `${y - 1}-${String(y).slice(-2)}`;
}

export function financialYearOptions(back = 3, forward = 1) {
  const cur = parseInt(currentFinancialYear().split('-')[0], 10);
  const opts = [];
  for (let i = forward; i >= -back; i--) {
    const y = cur + i;
    opts.push(`${y}-${String(y + 1).slice(-2)}`);
  }
  return opts;
}

/* ---------------------------------------------------------------------- */
/*  Atomic sequence generator — Firestore transactions give us the same    */
/*  race-condition-free guarantee as SQL "SELECT ... FOR UPDATE" locking.  */
/* ---------------------------------------------------------------------- */
export async function nextSequence(counterId, padLength = 6) {
  const ref = doc(db, 'counters', counterId);
  const next = await runTransaction(db, async (tx) => {
    const snap = await tx.get(ref);
    const current = snap.exists() ? (snap.data().value || 0) : 0;
    const val = current + 1;
    tx.set(ref, { value: val, updatedAt: serverTimestamp() }, { merge: true });
    return val;
  });
  return String(next).padStart(padLength, '0');
}

export async function generateMemberId() {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`member_${year}`, 6);
  return `MHM-${year}-${seq}`;
}

export async function generateReceiptNumber(financialYear) {
  const yearPart = financialYear.split('-')[0];
  const seq = await nextSequence(`receipt_${financialYear}`, 6);
  return `MHMRWS-${yearPart}-${seq}`;
}

/* ---------------------------------------------------------------------- */
/*  Public verification tokens                                             */
/*                                                                          */
/*  The QR code on a receipt or a membership card used to carry the         */
/*  sequential number itself — MHMRWS-2026-000004 — and the public          */
/*  verification collections were keyed by it. Anyone could therefore ask   */
/*  for 000001, 000002, 000003 ... and walk out with the society's entire   */
/*  resident directory and every payment it had ever banked, without an     */
/*  account and without tripping anything.                                  */
/*                                                                          */
/*  The QR now carries this instead: 128 random bits, which is not a space  */
/*  anyone walks. The human-readable receipt/member number is unchanged and */
/*  still printed on the document — it just is not the lookup key any more. */
/* ---------------------------------------------------------------------- */
export function newPublicToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (b) => b.toString(16).padStart(2, '0')).join('');
}

/* Records issued before the token change are still keyed by their sequential
   number, so receipts and cards already in residents' hands keep verifying.
   Everything issued from now on uses the token. */
export function publicKeyForReceipt(payment) {
  return payment?.publicToken || payment?.receiptNumber || '';
}
export function publicKeyForMember(member) {
  return member?.publicToken || member?.memberID || '';
}

/* ---------------------------------------------------------------------- */
/*  Activity log — append-only record of committee actions                 */
/*                                                                          */
/*  NOT an audit log, and deliberately no longer named like one. These      */
/*  entries are written by the browser of the admin performing the action,  */
/*  which means an admin who does not want an entry written simply does not */
/*  write one. Treat it as "what the committee did", useful for answering   */
/*  questions at an AGM — not as evidence in a dispute.                     */
/*                                                                          */
/*  The IP field is gone. It came from an ipify call made by the same       */
/*  browser being logged, so it recorded whatever that browser chose to     */
/*  report — an attacker-controlled value dressed up as forensic detail,    */
/*  which is worse than no value at all. It also sent every admin's IP to a */
/*  third party on every logged action. If the society ever needs a real    */
/*  audit trail, these writes must move into a Cloud Function, where        */
/*  context.auth and the true request IP are observed server-side.          */
/* ---------------------------------------------------------------------- */
export async function logAudit(user, action, details = {}) {
  try {
    await addDoc(collection(db, 'auditLogs'), {
      userId: user?.uid || 'system',
      userEmail: user?.email || 'system',
      action,
      details,
      source: 'client',   // honest about where this came from
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Activity log write failed:', e);
  }
}

/* ---------------------------------------------------------------------- */
/*  QR code generation (uses the `qrcode` UMD build — window.QRCode)       */
/* ---------------------------------------------------------------------- */
export function generateQR(text, size = 220) {
  return new Promise((resolve, reject) => {
    if (!window.QRCode) return reject(new Error('QR library not loaded'));
    window.QRCode.toDataURL(text, { width: size, margin: 1, color: { dark: '#0A1B33', light: '#FFFFFF' } }, (err, url) => {
      if (err) reject(err); else resolve(url);
    });
  });
}

/* Accepts a payment object. A bare string is still accepted so that any
   caller not yet updated keeps working against the legacy lookup. */
export function verifyUrlFor(payment) {
  const p = (typeof payment === 'string') ? { receiptNumber: payment } : (payment || {});
  const base = window.location.origin + window.location.pathname.replace(/[^/]+$/, '');
  return p.publicToken
    ? `${base}verify.html?r=${encodeURIComponent(p.publicToken)}`
    : `${base}verify.html?receipt=${encodeURIComponent(p.receiptNumber || '')}`;
}

/* ---------------------------------------------------------------------- */
/*  Receipt PDF (uses jsPDF — window.jspdf.jsPDF)                          */
/* ---------------------------------------------------------------------- */
export async function generateReceiptPDF({ payment, member, society, logoDataUrl, save = true }) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const marginX = 48;
  let y = 56;

  // Header band
  pdf.setFillColor(10, 27, 51);
  pdf.rect(0, 0, W, 100, 'F');
  if (logoDataUrl) {
    // Same flattening as the membership card: jsPDF fills the seal's
    // transparent corners with black, so it must be composited onto an
    // opaque white disc first.
    try {
      const sealImg = await sealOnWhiteDisc(logoDataUrl);
      if (sealImg) {
        const cx = marginX + 26, cy = 50, r = 27;
        pdf.setFillColor(255, 255, 255);
        pdf.circle(cx, cy, r, 'F');
        pdf.addImage(sealImg, 'JPEG', cx - r * 0.94, cy - r * 0.94, r * 1.88, r * 1.88);
        pdf.setDrawColor(228, 199, 101); pdf.setLineWidth(1);
        pdf.circle(cx, cy, r, 'S');
      }
    } catch (e) {/* receipt is still valid without the seal */}
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('times', 'bold'); pdf.setFontSize(18);
  pdf.text(society.fullName || 'Resident Welfare Society', marginX + 64, 46);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
  pdf.text(`Reg. No: ${society.regNumber || '—'}`, marginX + 64, 62);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
  pdf.text('PAYMENT RECEIPT', W - marginX, 46, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
  pdf.text(payment.receiptNumber || '', W - marginX, 62, { align: 'right' });

  y = 132;
  pdf.setTextColor(16, 25, 43);

  const col2X = W / 2 + 10;
  const rowGap = 20;

  function kv(label, value, x, yy) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(124, 135, 156);
    pdf.text(label.toUpperCase(), x, yy);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11.5); pdf.setTextColor(16, 25, 43);
    pdf.text(String(value ?? '—'), x, yy + 15);
  }

  kv('Receipt No.', payment.receiptNumber, marginX, y);
  kv('Date', fmtDate(payment.verifiedAt || payment.submittedAt), col2X, y);
  y += rowGap * 2;
  kv('Resident Name', member?.name, marginX, y);
  kv('Member ID', member?.memberID, col2X, y);
  y += rowGap * 2;
  kv('Flat / Tower', `${member?.flatNumber || '—'} / ${member?.tower || '—'}`, marginX, y);
  kv('Financial Year', payment.financialYear, col2X, y);
  y += rowGap * 2;
  kv('Payment Mode', (payment.mode || '').toUpperCase(), marginX, y);
  kv('Transaction / UTR No.', payment.utrOrChequeNo || '—', col2X, y);
  y += rowGap * 2.4;

  pdf.setDrawColor(201, 162, 39);
  pdf.setLineWidth(1);
  pdf.line(marginX, y, W - marginX, y);
  y += 30;

  // Amount box
  pdf.setFillColor(245, 246, 250);
  pdf.roundedRect(marginX, y, W - marginX * 2, 64, 8, 8, 'F');
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(124, 135, 156);
  pdf.text('AMOUNT PAID', marginX + 16, y + 22);
  pdf.setFont('times', 'bold'); pdf.setFontSize(22); pdf.setTextColor(10, 27, 51);
  pdf.text(formatINR(payment.amount), marginX + 16, y + 46);
  pdf.setFont('helvetica', 'italic'); pdf.setFontSize(9.5); pdf.setTextColor(70, 80, 102);
  pdf.text(numberToWordsINR(payment.amount), marginX + 16, y + 58, { maxWidth: W - marginX * 2 - 150 });

  // QR code
  try {
    const qrUrl = verifyUrlFor(payment);
    const qrData = await generateQR(qrUrl, 260);
    pdf.addImage(qrData, 'PNG', W - marginX - 74, y - 4, 74, 74);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(7); pdf.setTextColor(124, 135, 156);
    pdf.text('Scan to verify', W - marginX - 37, y + 78, { align: 'center' });
  } catch (e) { /* QR generation is best-effort; receipt still valid without it */ }

  y += 100;
  pdf.setDrawColor(226, 230, 239); pdf.setLineWidth(0.6);
  pdf.line(marginX, y, W - marginX, y);
  y += 22;
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(124, 135, 156);
  pdf.text('This is a system-generated receipt from the MHMRWS Digital Portal.', marginX, y);
  pdf.text(`Verify anytime at: ${verifyUrlFor(payment)}`, marginX, y + 13);

  if (save) {
    deliverPdf(pdf, `Receipt-${payment.receiptNumber}.pdf`);
    return null;
  }
  return pdf.output('blob');
}

/* ---------------------------------------------------------------------- */
/*  Payment statement PDF — a whole financial year on one page             */
/*                                                                          */
/*  A single receipt proves one payment; residents also need the full year */
/*  in one document — for a loan file, a rent agreement, an income proof.   */
/*  This lists every verified payment for the chosen FY with a running      */
/*  total, in the same navy-and-gold identity as the receipt, and paginates */
/*  automatically once a year has more rows than fit on a page.             */
/* ---------------------------------------------------------------------- */
export async function generateStatementPDF({ payments, member, society, financialYear, logoDataUrl, save = true }) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const marginX = 48;

  // Only verified payments belong on a statement — pending ones are not yet
  // money the society acknowledges receiving. Sorted oldest-first so the
  // running total reads down the page the way a passbook does.
  const rows = (payments || [])
    .filter(p => p.status === 'verified' && p.financialYear === financialYear)
    .sort((a, b) => tsMillis(a.verifiedAt || a.submittedAt) - tsMillis(b.verifiedAt || b.submittedAt));

  const drawHeader = async () => {
    pdf.setFillColor(10, 27, 51);
    pdf.rect(0, 0, W, 100, 'F');
    if (logoDataUrl) {
      try {
        const sealImg = await sealOnWhiteDisc(logoDataUrl);
        if (sealImg) {
          const cx = marginX + 26, cy = 50, r = 27;
          pdf.setFillColor(255, 255, 255); pdf.circle(cx, cy, r, 'F');
          pdf.addImage(sealImg, 'JPEG', cx - r * 0.94, cy - r * 0.94, r * 1.88, r * 1.88);
          pdf.setDrawColor(228, 199, 101); pdf.setLineWidth(1); pdf.circle(cx, cy, r, 'S');
        }
      } catch (e) {/* statement is still valid without the seal */}
    }
    pdf.setTextColor(255, 255, 255);
    pdf.setFont('times', 'bold'); pdf.setFontSize(18);
    pdf.text(society.fullName || 'Resident Welfare Society', marginX + 64, 46);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
    pdf.text(`Reg. No: ${society.regNumber || '—'}`, marginX + 64, 62);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
    pdf.text('PAYMENT STATEMENT', W - marginX, 46, { align: 'right' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(`FY ${financialYear}`, W - marginX, 62, { align: 'right' });
  };

  await drawHeader();

  // Resident block
  let y = 128;
  pdf.setTextColor(16, 25, 43);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(124, 135, 156);
  pdf.text('RESIDENT', marginX, y);
  pdf.text('FLAT / TOWER', W / 2 + 10, y);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(12); pdf.setTextColor(16, 25, 43);
  pdf.text(member?.name || '—', marginX, y + 16);
  pdf.text(`${member?.flatNumber || '—'} / ${member?.tower || '—'}`, W / 2 + 10, y + 16);
  if (member?.memberID) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(124, 135, 156);
    pdf.text(`Member ID: ${member.memberID}`, marginX, y + 30);
  }
  y += 50;

  // Table header
  const cols = { date: marginX, receipt: marginX + 96, mode: marginX + 250, amount: W - marginX };
  const drawTableHead = () => {
    pdf.setFillColor(245, 246, 250);
    pdf.rect(marginX, y, W - marginX * 2, 22, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(8.5); pdf.setTextColor(70, 80, 102);
    pdf.text('DATE', cols.date + 6, y + 15);
    pdf.text('RECEIPT NO.', cols.receipt, y + 15);
    pdf.text('MODE', cols.mode, y + 15);
    pdf.text('AMOUNT', cols.amount - 6, y + 15, { align: 'right' });
    y += 22;
  };
  drawTableHead();

  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
  let runningTotal = 0;

  for (const p of rows) {
    // New page when we run low, repeating the header and column titles.
    if (y > H - 120) {
      pdf.addPage();
      y = 60;
      drawTableHead();
      pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
    }
    runningTotal += Number(p.amount) || 0;
    pdf.setTextColor(16, 25, 43);
    pdf.text(fmtDate(p.verifiedAt || p.submittedAt), cols.date + 6, y + 15);
    pdf.setFontSize(9);
    pdf.text(String(p.receiptNumber || '—'), cols.receipt, y + 15);
    pdf.setFontSize(10);
    pdf.text((p.mode || '—').toUpperCase(), cols.mode, y + 15);
    pdf.text(formatINR(p.amount), cols.amount - 6, y + 15, { align: 'right' });
    pdf.setDrawColor(226, 230, 239); pdf.setLineWidth(0.5);
    pdf.line(marginX, y + 22, W - marginX, y + 22);
    y += 24;
  }

  if (!rows.length) {
    pdf.setTextColor(124, 135, 156); pdf.setFont('helvetica', 'italic');
    pdf.text(`No verified payments recorded for FY ${financialYear}.`, marginX, y + 18);
    y += 30;
  }

  // Total band
  y += 8;
  pdf.setFillColor(10, 27, 51);
  pdf.roundedRect(marginX, y, W - marginX * 2, 46, 8, 8, 'F');
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(228, 199, 101);
  pdf.text(`TOTAL PAID · FY ${financialYear}`, marginX + 16, y + 20);
  pdf.setFont('times', 'bold'); pdf.setFontSize(18); pdf.setTextColor(255, 255, 255);
  pdf.text(formatINR(runningTotal), W - marginX - 16, y + 30, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(180, 190, 205);
  pdf.text(`${rows.length} payment${rows.length === 1 ? '' : 's'}`, marginX + 16, y + 34);

  // Footer
  y += 70;
  pdf.setDrawColor(226, 230, 239); pdf.setLineWidth(0.6);
  pdf.line(marginX, y, W - marginX, y);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(124, 135, 156);
  pdf.text('This is a system-generated statement from the MHMRWS Digital Portal.', marginX, y + 16);
  pdf.text(`Generated on ${fmtDate(new Date())}. Each receipt can be verified individually via its QR code.`, marginX, y + 28);

  if (save) {
    deliverPdf(pdf, `Statement-${member?.flatNumber || 'MHMRWS'}-FY${financialYear}.pdf`);
    return null;
  }
  return pdf.output('blob');
}

/* ---------------------------------------------------------------------- */
/*  Shared UI helpers — skeletons, empty states, inline field errors        */
/* ---------------------------------------------------------------------- */

/* A block of placeholder rows shaped like a two-line list item with a pill on
   the right — matches the payment history, notices and documents lists. Drop
   the returned HTML into a container while its data loads. */
export function skeletonList(count = 3) {
  const row = `
    <div class="sk-row">
      <div class="sk-stack">
        <div class="sk-line sk sk-w-60"></div>
        <div class="sk-line sk sk-w-40"></div>
      </div>
      <div class="sk-line sk sk-pill"></div>
    </div>`;
  return row.repeat(count);
}

/* Placeholder rows for a table body; spans the given column count so the layout
   does not collapse while loading. */
export function skeletonTableRows(cols = 4, rows = 4) {
  const widths = ['sk-w-60', 'sk-w-40', 'sk-w-80', 'sk-w-25', 'sk-w-60'];
  const tr = () => `<tr>${Array.from({ length: cols }, (_, i) =>
    `<td><div class="sk-line sk ${widths[i % widths.length]}"></div></td>`).join('')}</tr>`;
  return tr().repeat(rows);
}

/* A consistent empty state everywhere — the same small seal, a heading and a
   line of guidance — instead of the assortment of bare "No records" strings
   the panels grew independently. */
export function emptyState(heading, detail = '', { compact = false } = {}) {
  const seal = `<svg class="seal" width="40" height="40" viewBox="0 0 24 24" aria-hidden="true">
    <circle cx="12" cy="12" r="10.5" fill="none" stroke="var(--gold-500)" stroke-width="1.2"/>
    <circle cx="12" cy="12" r="7.5" fill="none" stroke="var(--line)" stroke-width="1"/>
    <path d="M8.5 12.2l2.4 2.4 4.6-4.8" fill="none" stroke="var(--gold-700)" stroke-width="1.4"
      stroke-linecap="round" stroke-linejoin="round"/></svg>`;
  return `<div class="empty${compact ? ' empty-sm' : ''}">${seal}
    <h4>${escapeHtml(heading)}</h4>${detail ? `<p>${escapeHtml(detail)}</p>` : ''}</div>`;
}

/* Mark a form field as invalid with a message directly beneath it. Expects the
   input to live inside a .field wrapper (the registration form's structure).
   Returns false so callers can `if (!showFieldError(...)) return;`-style guard. */
export function showFieldError(input, message) {
  const field = input?.closest('.field');
  if (!field) return false;
  field.classList.add('has-error');
  let el = field.querySelector('.field-error');
  if (!el) { el = document.createElement('div'); el.className = 'field-error'; field.appendChild(el); }
  el.textContent = message;
  return false;
}

export function clearFieldErrors(form) {
  form?.querySelectorAll('.field.has-error').forEach(f => f.classList.remove('has-error'));
}

/* ---------------------------------------------------------------------- */
/*  Idle auto-logout                                                        */
/*                                                                          */
/*  A committee member who signs in on a shared or public device and walks  */
/*  away leaves the financial panel open to whoever sits down next. This    */
/*  watches for inactivity, shows a warning with a countdown, and signs the  */
/*  user out if they do not respond. Any real interaction resets the timer.  */
/*                                                                          */
/*  Call startIdleLogout({ onLogout, warnAfterMs, graceMs }). Returns a stop */
/*  function to call on sign-out so the timers do not outlive the session.   */
/* ---------------------------------------------------------------------- */
export function startIdleLogout({ onLogout, warnAfterMs = 25 * 60 * 1000, graceMs = 60 * 1000 } = {}) {
  let warnTimer = null, graceTimer = null, banner = null, countdown = null;

  const clearBanner = () => {
    countdown && clearInterval(countdown); countdown = null;
    banner && banner.remove(); banner = null;
    graceTimer && clearTimeout(graceTimer); graceTimer = null;
  };

  const doLogout = () => { clearBanner(); stop(); onLogout?.(); };

  const showWarning = () => {
    if (banner) return;
    let left = Math.round(graceMs / 1000);
    banner = document.createElement('div');
    banner.className = 'session-banner';
    banner.setAttribute('role', 'alertdialog');
    banner.innerHTML = `<span>Suraksha ke liye aapko <b class="sec">${left}</b> second mein logout kiya jaayega.</span>
      <button class="stay">Logged in rahein</button>
      <button class="out">Abhi logout</button>`;
    document.body.appendChild(banner);
    banner.querySelector('.stay').onclick = () => { clearBanner(); reset(); };
    banner.querySelector('.out').onclick = doLogout;
    countdown = setInterval(() => {
      left -= 1;
      const s = banner?.querySelector('.sec'); if (s) s.textContent = left;
      if (left <= 0) doLogout();
    }, 1000);
    graceTimer = setTimeout(doLogout, graceMs);
  };

  const reset = () => {
    if (banner) return;                 // don't reset while the warning is up
    warnTimer && clearTimeout(warnTimer);
    warnTimer = setTimeout(showWarning, warnAfterMs);
  };

  // Throttle: activity fires constantly, but we only need to push the timer.
  let last = 0;
  const onActivity = () => {
    const now = Date.now();
    if (now - last < 1000) return;
    last = now;
    reset();
  };
  const events = ['click', 'keydown', 'touchstart', 'scroll', 'mousemove'];
  events.forEach(e => document.addEventListener(e, onActivity, { passive: true }));

  function stop() {
    warnTimer && clearTimeout(warnTimer);
    clearBanner();
    events.forEach(e => document.removeEventListener(e, onActivity));
  }

  reset();
  return stop;
}

/* ---------------------------------------------------------------------- */
/*  Pagination                                                              */
/*                                                                          */
/*  Tables that load an unbounded set — the member directory, the full      */
/*  payment ledger — are fine today at a few hundred rows but grow every    */
/*  year, and rendering all of them at once is what makes the admin panel   */
/*  crawl on a phone. This renders a compact pager (‹ 1 … 4 5 6 … 12 ›) into */
/*  a container; the caller slices its own rows and re-renders on change.   */
/* ---------------------------------------------------------------------- */
export function renderPager(container, { page, pageSize, total, onPage }) {
  if (!container) return;
  const pages = Math.max(1, Math.ceil(total / pageSize));
  if (pages <= 1) { container.innerHTML = ''; return; }

  page = Math.min(Math.max(1, page), pages);
  const from = (page - 1) * pageSize + 1;
  const to = Math.min(page * pageSize, total);

  // Window of page numbers around the current one, with ellipses.
  const nums = [];
  const push = (n) => nums.push(n);
  const window = 1;
  for (let n = 1; n <= pages; n++) {
    if (n === 1 || n === pages || (n >= page - window && n <= page + window)) push(n);
    else if (nums[nums.length - 1] !== '…') push('…');
  }

  container.innerHTML = `
    <div class="pager-info">${from}–${to} of ${total}</div>
    <div class="pager-btns">
      <button class="pager-btn" data-pg="${page - 1}" ${page === 1 ? 'disabled' : ''} aria-label="Previous page">‹</button>
      ${nums.map(n => n === '…'
        ? `<span class="pager-gap">…</span>`
        : `<button class="pager-btn ${n === page ? 'is-current' : ''}" data-pg="${n}" ${n === page ? 'aria-current="page"' : ''}>${n}</button>`
      ).join('')}
      <button class="pager-btn" data-pg="${page + 1}" ${page === pages ? 'disabled' : ''} aria-label="Next page">›</button>
    </div>`;

  container.querySelectorAll('.pager-btn[data-pg]').forEach(b => {
    if (b.disabled) return;
    b.addEventListener('click', () => {
      const p = parseInt(b.dataset.pg, 10);
      if (p >= 1 && p <= pages && p !== page) onPage(p);
    });
  });
}



export function serializeForExport(rows) {
  return (rows || []).map(row => {
    const clean = {};
    for (const [k, v] of Object.entries(row)) {
      clean[k] = (v && typeof v.toDate === 'function') ? v.toDate().toISOString() : v;
    }
    return clean;
  });
}

/* ---------------------------------------------------------------------- */
/*  Printable receipt (browser print — complements the jsPDF download).    */
/*  Uses whatever paper size the person's print dialog/printer offers, so  */
/*  this is what actually covers A4 / Half-A4 / 3" thermal in practice.    */
/* ---------------------------------------------------------------------- */
export async function printReceipt({ payment, member, society, logoDataUrl }) {
  let qrImg = '';
  try { qrImg = await generateQR(verifyUrlFor(payment), 200); } catch (e) {/* print still works without the QR */}

  const area = document.getElementById('printReceiptArea');
  if (!area) { showToast('Print area is missing from this page.', 'error'); return; }

  area.innerHTML = `
    <div class="print-receipt">
      <div class="pr-head">
        ${logoDataUrl ? `<img src="${logoDataUrl}" alt="">` : ''}
        <div>
          <h1>${escapeHtml(society.fullName || 'Resident Welfare Society')}</h1>
          <p>Reg. No: ${escapeHtml(society.regNumber || '—')}</p>
        </div>
        <div class="pr-title"><b>PAYMENT RECEIPT</b><br>${escapeHtml(payment.receiptNumber || '')}</div>
      </div>
      <div class="pr-grid">
        <div><b>Receipt No.</b>${escapeHtml(payment.receiptNumber || '—')}</div>
        <div><b>Date</b>${fmtDate(payment.verifiedAt || payment.submittedAt)}</div>
        <div><b>Resident Name</b>${escapeHtml(member?.name || '—')}</div>
        <div><b>Member ID</b>${escapeHtml(member?.memberID || '—')}</div>
        <div><b>Flat / Tower</b>${escapeHtml(member?.flatNumber || '—')} / ${escapeHtml(member?.tower || '—')}</div>
        <div><b>Financial Year</b>${escapeHtml(payment.financialYear || '—')}</div>
        <div><b>Payment Mode</b>${escapeHtml((payment.mode || '').toUpperCase())}</div>
        <div><b>Transaction / UTR No.</b>${escapeHtml(payment.utrOrChequeNo || '—')}</div>
      </div>
      <div class="pr-amount">
        <div>
          <b style="display:block;font-size:9.5px;text-transform:uppercase;color:#666;">Amount Paid</b>
          <span class="num">${formatINR(payment.amount)}</span><br>
          <span style="font-size:11px;font-style:italic;color:#444;">${escapeHtml(numberToWordsINR(payment.amount))}</span>
        </div>
        ${qrImg ? `<div class="pr-qr"><img src="${qrImg}" alt="Verify QR"><div style="font-size:8.5px;color:#666;">Scan to verify</div></div>` : ''}
      </div>
      <div class="pr-foot">
        This is a system-generated receipt from the MHMRWS Digital Portal.<br>
        Verify anytime at: ${escapeHtml(verifyUrlFor(payment))}
      </div>
    </div>
  `;

  document.body.classList.add('printing-receipt');
  const cleanup = () => { document.body.classList.remove('printing-receipt'); area.innerHTML = ''; window.removeEventListener('afterprint', cleanup); };
  window.addEventListener('afterprint', cleanup);
  window.print();
}

/* ---------------------------------------------------------------------- */
/*  Membership card                                                        */
/*                                                                          */
/*  A standard 85.6 x 54 mm card a resident can print or keep on their      */
/*  phone, with the society's own building as a darkened backdrop and a QR  */
/*  that resolves to the public verification page — so a guard at the gate  */
/*  can confirm the membership is genuine and still active.                 */
/*                                                                          */
/*  Only ever generated for an approved member; see the caller in           */
/*  index.html, which hides the button otherwise.                           */
/* ---------------------------------------------------------------------- */
const CARD_W = 85.6, CARD_H = 54;   // mm — ISO/IEC 7810 ID-1, the usual card size

export function memberVerifyUrl(member) {
  const m = (typeof member === 'string') ? { memberID: member } : (member || {});
  const base = window.location.origin + window.location.pathname.replace(/[^/]+$/, '');
  return m.publicToken
    ? `${base}verify.html?m=${encodeURIComponent(m.publicToken)}`
    : `${base}verify.html?member=${encodeURIComponent(m.memberID || '')}`;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    // crossOrigin only matters for genuinely remote images (e.g. a photo in
    // Firebase Storage). For a data: URI or a same-origin file it can cause a
    // needless load failure or a tainted canvas on some hosts, which is exactly
    // what broke membership-card generation. So set it only for http(s) sources.
    if (/^https?:/i.test(src)) img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);   // a missing backdrop must not break the card
    img.src = src;
  });
}

function imageToDataUrl(img, mime = 'image/jpeg', quality = 0.85) {
  const c = document.createElement('canvas');
  c.width = img.naturalWidth; c.height = img.naturalHeight;
  c.getContext('2d').drawImage(img, 0, 0);
  return c.toDataURL(mime, quality);
}

/**
 * Flattens the society seal onto an opaque white disc.
 *
 * The seal is a WebP with transparent corners. jsPDF does not carry that
 * transparency through — it fills the alpha area with black, which turned the
 * seal into a dark square sitting on top of the white circle drawn behind it.
 * Compositing here means jsPDF only ever receives an opaque JPEG, so the seal
 * reads correctly on both the card and the receipt.
 *
 * @returns {Promise<string|null>} an opaque JPEG data URL, or null if the
 *          seal could not be loaded (callers then simply omit it).
 */
export async function sealOnWhiteDisc(logoDataUrl, size = 256) {
  if (!logoDataUrl) return null;
  try {
    const img = await loadImage(logoDataUrl);
    if (!img) return null;
    const c = document.createElement('canvas');
    c.width = c.height = size;
    const g = c.getContext('2d');
    // opaque white square first — no alpha survives into the PDF
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, size, size);
    // then a slightly inset seal, leaving a clean white rim around the navy ring
    const pad = size * 0.045;
    g.drawImage(img, pad, pad, size - pad * 2, size - pad * 2);
    // toDataURL throws on a tainted canvas (a cross-origin image drawn without
    // CORS). Returning null then just means "no seal", never a broken card.
    return c.toDataURL('image/jpeg', 0.92);
  } catch (e) {
    return null;
  }
}

export async function generateMembershipCard({ member, society, logoDataUrl, financialYear, officeAddress }) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'mm', format: [CARD_W, CARD_H], orientation: 'landscape' });

  // --- backdrop: the building, heavily dimmed so text stays legible -------
  pdf.setFillColor(15, 37, 71);
  pdf.rect(0, 0, CARD_W, CARD_H, 'F');

  const bg = await loadImage('mhm-card-bg.jpg');
  if (bg) {
    try {
      // cover-fit: the source strip is wider than the card, so crop the sides
      const srcRatio = bg.naturalWidth / bg.naturalHeight;
      let dw = CARD_W, dh = CARD_W / srcRatio;
      if (dh < CARD_H) { dh = CARD_H; dw = CARD_H * srcRatio; }
      const dx = (CARD_W - dw) / 2, dy = (CARD_H - dh) / 2;
      pdf.saveGraphicsState();
      pdf.setGState(new pdf.GState({ opacity: 0.30 }));
      pdf.addImage(imageToDataUrl(bg), 'JPEG', dx, dy, dw, dh);
      pdf.restoreGraphicsState();
    } catch (e) { /* keep the plain navy card if the image can't be composited */ }
  }

  // navy scrim over the left two-thirds, where all the text sits
  pdf.saveGraphicsState();
  pdf.setGState(new pdf.GState({ opacity: 0.55 }));
  pdf.setFillColor(10, 27, 51);
  pdf.rect(0, 0, CARD_W, CARD_H, 'F');
  pdf.restoreGraphicsState();

  // saffron top edge + gold hairline under the header
  pdf.setFillColor(255, 153, 51);
  pdf.rect(0, 0, CARD_W, 1.1, 'F');

  const M = 5;   // margin

  // --- header ------------------------------------------------------------
  // The seal is flattened onto an opaque white disc first — see
  // sealOnWhiteDisc() for why jsPDF cannot be handed the transparent original.
  // Wrapped so a seal problem (e.g. a canvas-export quirk) leaves a plain card
  // rather than failing the whole download.
  let sealImg = null;
  try { sealImg = await sealOnWhiteDisc(logoDataUrl); } catch (e) { sealImg = null; }
  if (sealImg) {
    try {
      const cx = M + 3.6, cy = 7.4, r = 3.9;
      pdf.setFillColor(255, 255, 255);
      pdf.circle(cx, cy, r, 'F');                       // white backing disc
      pdf.addImage(sealImg, 'JPEG', cx - r * 0.94, cy - r * 0.94, r * 1.88, r * 1.88);
      pdf.setDrawColor(228, 199, 101); pdf.setLineWidth(0.28);
      pdf.circle(cx, cy, r, 'S');                       // gold rim
    } catch (e) {}
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(7.4);
  pdf.text(society.name || 'Max Heights Majestic', M + 9.2, 6.9);
  pdf.setFont('courier', 'normal'); pdf.setFontSize(4.4);
  pdf.setTextColor(255, 201, 120);
  pdf.text('RESIDENT WELFARE SOCIETY', M + 9.2, 9.6);

  pdf.setFont('courier', 'normal'); pdf.setFontSize(4);
  pdf.setTextColor(190, 200, 215);
  pdf.text('VALID FOR', CARD_W - M, 6.6, { align: 'right' });
  pdf.setFontSize(6.4); pdf.setTextColor(255, 201, 120);
  pdf.text(`FY ${financialYear}`, CARD_W - M, 9.6, { align: 'right' });

  pdf.setDrawColor(228, 199, 101); pdf.setLineWidth(0.2);
  pdf.line(M, 12, CARD_W - M, 12);

  // --- photo -------------------------------------------------------------
  const photoX = M, photoY = 15, photoW = 13, photoH = 16.5;
  pdf.setFillColor(255, 255, 255);
  pdf.setDrawColor(228, 199, 101); pdf.setLineWidth(0.25);
  pdf.roundedRect(photoX, photoY, photoW, photoH, 1, 1, 'FD');
  // Use the resident's photo if we have one, otherwise a neutral silhouette so
  // the frame never looks broken or empty.
  const photoImg = member.photoDataUrl || AVATAR_PLACEHOLDER;
  try { pdf.addImage(photoImg, 'JPEG', photoX + 0.4, photoY + 0.4, photoW - 0.8, photoH - 0.8); }
  catch (e) {}

  // --- details -----------------------------------------------------------
  const dx = photoX + photoW + 4;
  const label = (t, y) => { pdf.setFont('courier','normal'); pdf.setFontSize(3.9); pdf.setTextColor(185,196,212); pdf.text(t, dx, y); };
  const value = (t, y, size = 8) => { pdf.setFont('helvetica','bold'); pdf.setFontSize(size); pdf.setTextColor(255,255,255); pdf.text(t, dx, y); };

  label('MEMBER NAME', 18);
  value(String(member.name || '').slice(0, 26), 22.4, 9);

  label('TOWER / FLAT', 27.6);
  value(`${member.tower || '—'}  ·  ${member.flatNumber || '—'}`, 31.6, 7.6);

  pdf.setFont('courier','normal'); pdf.setFontSize(3.9); pdf.setTextColor(185,196,212);
  pdf.text('STATUS', dx + 26, 27.6);
  pdf.setFont('helvetica','bold'); pdf.setFontSize(7.6); pdf.setTextColor(255,255,255);
  pdf.text((member.residentType || '—').replace(/^\w/, c => c.toUpperCase()), dx + 26, 31.6);

  // --- QR ----------------------------------------------------------------
  try {
    const qr = await generateQR(memberVerifyUrl(member), 320);
    const qs = 15.5, qx = CARD_W - M - qs, qy = 15.5;
    pdf.setFillColor(255, 255, 255);
    pdf.roundedRect(qx - 0.8, qy - 0.8, qs + 1.6, qs + 1.6, 0.8, 0.8, 'F');
    pdf.addImage(qr, 'PNG', qx, qy, qs, qs);
    pdf.setFont('courier','normal'); pdf.setFontSize(3.4); pdf.setTextColor(190,200,215);
    pdf.text('SCAN TO VERIFY', qx + qs / 2, qy + qs + 2.6, { align: 'center' });
  } catch (e) { /* card is still valid without the QR */ }

  // --- footer ------------------------------------------------------------
  pdf.setDrawColor(255, 255, 255); pdf.setLineWidth(0.12);
  pdf.line(M, CARD_H - 9.6, CARD_W - M, CARD_H - 9.6);

  pdf.setFont('courier','normal'); pdf.setFontSize(3.9); pdf.setTextColor(185,196,212);
  pdf.text('MEMBER ID', M, CARD_H - 6.4);
  pdf.setFont('courier','bold'); pdf.setFontSize(8); pdf.setTextColor(255, 201, 120);
  pdf.text(String(member.memberID || '—'), M, CARD_H - 2.6);

  pdf.setFont('courier','normal'); pdf.setFontSize(3.3); pdf.setTextColor(165,178,196);
  // Office address (or a short fallback) shown bottom-right so residents know
  // where to visit or contact. Wrapped to two short lines to fit the footer.
  const addr = (officeAddress || 'Grand Sikar Road, Jaipur').trim();
  const addrLines = pdf.splitTextToSize(addr, 62).slice(0, 3);
  let ay = CARD_H - 2.6 - (addrLines.length - 1) * 3.0;
  if (society.regNumber) { pdf.text(`Reg. ${society.regNumber}`, CARD_W - M, ay - 3.2, { align: 'right' }); }
  addrLines.forEach((ln) => { pdf.text(ln, CARD_W - M, ay, { align: 'right' }); ay += 3.0; });

  // Delivery. pdf.save() alone fails silently in many mobile and in-app
  // browsers (WhatsApp/Instagram webviews, some Android/iOS setups) — no
  // download prompt ever appears, which reads to the user as "nothing
  // happened". So build the file as a blob and hand it over the most reliable
  // way for the device: a real <a download> click, with a new-tab fallback.
  const filename = `MHMRWS-Card-${member.memberID || 'member'}.pdf`;
  deliverPdf(pdf, filename);
}

/* Save a jsPDF document in a way that works on phones as well as desktops.
   Tries an <a download> click (honours the filename on desktop and most of
   Android); if the environment blocks blob downloads, opens the PDF in a new
   tab so the user can save it from there. Never throws. */
export function deliverPdf(pdf, filename) {
  try {
    const blob = pdf.output('blob');
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    // Some webviews ignore the download attribute; give them a tab too.
    setTimeout(() => {
      try { URL.revokeObjectURL(url); } catch (_) {}
    }, 60000);
    return true;
  } catch (e) {
    // Last resort: jsPDF's own save, then a data-URI tab.
    try { pdf.save(filename); return true; }
    catch (e2) {
      try { window.open(pdf.output('dataurlstring'), '_blank'); return true; }
      catch (e3) { throw e3; }
    }
  }
}

/* ---------------------------------------------------------------------- */
/*  Excel export / import (uses SheetJS — window.XLSX)                    */
/* ---------------------------------------------------------------------- */
export function exportToExcel(rows, filename = 'export.xlsx', sheetName = 'Sheet1') {
  if (!rows || !rows.length) { showToast('Export karne ke liye koi data nahi mila.', 'error'); return; }
  const ws = window.XLSX.utils.json_to_sheet(rows);
  const wb = window.XLSX.utils.book_new();
  window.XLSX.utils.book_append_sheet(wb, ws, sheetName);
  window.XLSX.writeFile(wb, filename);
}

export function parseExcelFile(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      try {
        const wb = window.XLSX.read(e.target.result, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        resolve(window.XLSX.utils.sheet_to_json(sheet, { defval: '' }));
      } catch (err) { reject(err); }
    };
    reader.onerror = reject;
    reader.readAsArrayBuffer(file);
  });
}

/* ---------------------------------------------------------------------- */
/*  Client-side AES-256-GCM encryption for Aadhaar/PAN uploads.            */
/*  NOTE ON KEY MANAGEMENT: the passphrase is set by your Super Admin and  */
/*  never stored in the database or in this code. Anyone who needs to      */
/*  view a document (e.g. Treasurer verifying identity) must be told the   */
/*  passphrase out-of-band. This is a genuine hardening layer on top of    */
/*  Storage security rules — not a replacement for them. See SETUP-GUIDE.  */
/* ---------------------------------------------------------------------- */
async function deriveAesKey(passphrase, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(passphrase), 'PBKDF2', false, ['deriveKey']);
  return crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 150000, hash: 'SHA-256' },
    keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );
}

export async function encryptFile(file, passphrase) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveAesKey(passphrase, salt);
  const buf = await file.arrayBuffer();
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, buf);
  const combined = new Uint8Array(salt.length + iv.length + encrypted.byteLength);
  combined.set(salt, 0); combined.set(iv, salt.length); combined.set(new Uint8Array(encrypted), salt.length + iv.length);
  return new Blob([combined], { type: 'application/octet-stream' });
}

export async function decryptToBlob(blob, passphrase, mimeType = 'application/octet-stream') {
  const buf = await blob.arrayBuffer();
  const bytes = new Uint8Array(buf);
  const salt = bytes.slice(0, 16);
  const iv = bytes.slice(16, 28);
  const data = bytes.slice(28);
  const key = await deriveAesKey(passphrase, salt);
  const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return new Blob([decrypted], { type: mimeType });
}

/* ---------------------------------------------------------------------- */
/*  Google Drive backup — Google Identity Services token client            */
/*  (drive.file scope: this app can only see/manage files IT created)      */
/* ---------------------------------------------------------------------- */
function loadGis() {
  return new Promise((resolve, reject) => {
    if (window.google?.accounts?.oauth2) return resolve();
    const s = document.createElement('script');
    s.src = 'https://accounts.google.com/gsi/client';
    s.onload = resolve; s.onerror = () => reject(new Error('Google Identity Services load failed'));
    document.head.appendChild(s);
  });
}

async function getDriveToken(clientId) {
  await loadGis();
  return new Promise((resolve, reject) => {
    const client = window.google.accounts.oauth2.initTokenClient({
      client_id: clientId,
      scope: 'https://www.googleapis.com/auth/drive.file',
      callback: (resp) => (resp.error ? reject(resp) : resolve(resp.access_token))
    });
    client.requestAccessToken({ prompt: '' });
  });
}

async function driveFindOrCreateFolder(token, name, parentId = null) {
  let q = `mimeType='application/vnd.google-apps.folder' and name='${name}' and trashed=false`;
  if (parentId) q += ` and '${parentId}' in parents`;
  const res = await fetch(`https://www.googleapis.com/drive/v3/files?q=${encodeURIComponent(q)}&fields=files(id,name)`, {
    headers: { Authorization: `Bearer ${token}` }
  });
  const data = await res.json();
  if (data.files?.length) return data.files[0].id;
  const metadata = { name, mimeType: 'application/vnd.google-apps.folder' };
  if (parentId) metadata.parents = [parentId];
  const created = await fetch('https://www.googleapis.com/drive/v3/files', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify(metadata)
  }).then(r => r.json());
  return created.id;
}

async function driveUploadJSON(token, folderId, filename, jsonData) {
  const boundary = 'mhmrws-' + Date.now();
  const metadata = { name: filename, parents: [folderId] };
  const body =
    `--${boundary}\r\nContent-Type: application/json; charset=UTF-8\r\n\r\n${JSON.stringify(metadata)}\r\n` +
    `--${boundary}\r\nContent-Type: application/json\r\n\r\n${JSON.stringify(jsonData, null, 2)}\r\n--${boundary}--`;
  const res = await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart&fields=id,name,webViewLink', {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': `multipart/related; boundary=${boundary}` },
    body
  });
  return res.json();
}

/**
 * Backs up an object of { collectionName: arrayOfDocs } to
 * Google Drive → MHMRWS/Database/<collection>_<timestamp>.json
 */
export async function backupToDrive(clientId, collectionsBundle) {
  if (!clientId || clientId.startsWith('REPLACE_WITH')) {
    throw new Error('Google OAuth Client ID abhi configure nahi hua hai. SETUP-GUIDE.md ka Step 5 dekhein.');
  }
  const token = await getDriveToken(clientId);
  const rootId = await driveFindOrCreateFolder(token, 'MHMRWS');
  const dbFolderId = await driveFindOrCreateFolder(token, 'Database', rootId);
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const uploaded = [];
  for (const [name, data] of Object.entries(collectionsBundle)) {
    const res = await driveUploadJSON(token, dbFolderId, `${name}_${stamp}.json`, data);
    uploaded.push(res.name || `${name}_${stamp}.json`);
  }
  return { folderPath: 'MHMRWS/Database', files: uploaded, timestamp: stamp };
}

/* ---------------------------------------------------------------------- */
/*  WhatsApp share-link helper (manual send — see SETUP-GUIDE for the      */
/*  WhatsApp Business API upgrade path for a fully automated bot)          */
/* ---------------------------------------------------------------------- */
export function waLink(mobile, message) {
  const digits = String(mobile || '').replace(/\D/g, '');
  const withCountry = digits.length === 10 ? `91${digits}` : digits;
  return `https://wa.me/${withCountry}?text=${encodeURIComponent(message)}`;
}

/* Share sheet with no fixed recipient — WhatsApp lets the user pick the chat or
   group. This is what a notice "Share on WhatsApp" button needs: the committee
   posts to the society group, a resident forwards to a neighbour. */
export function waShareText(message) {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/* NOTE: zipFilesFromUrls() used to live here. It fetched every file into
   memory before zipping, which would fall over on a phone for a bulk export of
   a few hundred ID scans — and nothing called it, since admin.html has its own
   month-scoped version with progress reporting. Removed rather than left as a
   trap for the next person who goes looking for a bulk-export helper. */
