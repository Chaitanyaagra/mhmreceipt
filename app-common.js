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
} from "https://www.gstatic.com/firebasejs/12.18.0/firebase-firestore.js";

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
  utrMin: 6,
  // Must stay <= firestore.rules' isOptionalString(..., 'utrOrChequeNo', 40)
  // limit on payments.create/update, and matches the maxlength="40" already
  // used on the membership-fee UTR field elsewhere in index.html. This was
  // 22 until a real HDFC UPI transaction ID (24 characters) got rejected on
  // the live site — 22 was never based on an actual UTR-format survey, it
  // was just too tight.
  utrMax: 40
};

export const PAYMENT_MODES = ['cash', 'cheque', 'upi', 'netbanking'];

/**
 * Validates a payment before submission.
 * @returns {string|null} an error message, or null when the payment is valid.
 */
export function validatePayment({ amount, mode, utr, isOffline }) {
  const amt = Number(amount);
  if (!Number.isFinite(amt)) return 'Amount must be a valid number.';
  if (amt < LIMITS.amountMin) return 'Amount must be at least ₹1.';
  if (amt > LIMITS.amountMax) return `Amount cannot exceed ₹${LIMITS.amountMax.toLocaleString('en-IN')}. Please contact the office for amounts this large.`;
  if (Math.round(amt * 100) !== amt * 100) return 'Amount cannot have more than two decimal places.';
  if (!PAYMENT_MODES.includes(mode)) return 'Invalid payment mode.';
  if (!isOffline) {
    const t = String(utr || '').trim();
    if (!t) return 'UTR / Transaction ID is required.';
    if (!/^[a-zA-Z0-9]+$/.test(t)) return 'UTR / Transaction ID can only contain letters and numbers.';
    if (t.length < LIMITS.utrMin || t.length > LIMITS.utrMax)
      return `UTR / Transaction ID must be ${LIMITS.utrMin}-${LIMITS.utrMax} characters long.`;
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
  const residentType = val('residentType');

  if (!name) return { field: 'name', message: 'Name is required.' };
  if (name.length > LIMITS.nameMax) return { field: 'name', message: `Name cannot be longer than ${LIMITS.nameMax} characters.` };
  // \p{M} matters here: Devanagari matras (ा ि ो) are Unicode *Marks*, not
  // Letters, so without it every Hindi name would be rejected.
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(name)) return { field: 'name', message: "Name can only contain letters, spaces, and . ' -" };

  if (!father) return { field: 'fatherHusbandName', message: "Father's / Spouse's name is required." };
  if (father.length > LIMITS.nameMax) return { field: 'fatherHusbandName', message: "Father's / Spouse's name is too long." };
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(father)) return { field: 'fatherHusbandName', message: "Father's / Spouse's name can only contain letters and spaces." };

  if (!tower) return { field: 'tower', message: 'Please select a tower.' };
  if (!TOWER_PLAN[tower]) return { field: 'tower', message: 'Invalid tower.' };
  if (!flat) return { field: 'flatNumber', message: 'Please select a flat number.' };
  if (!isValidFlat(tower, flat)) return { field: 'flatNumber', message: `Flat ${flat} does not exist in Tower ${tower}.` };

  // Indian mobile numbers begin 6, 7, 8 or 9 — this rejects landlines and
  // the common habit of typing a 0 or +91 prefix into the field.
  if (!/^[0-9]{10}$/.test(mobile)) return { field: 'mobile', message: 'Mobile number must be exactly 10 digits (without a leading 0 or +91).' };
  if (!/^[6-9]/.test(mobile)) return { field: 'mobile', message: 'Mobile number must start with 6, 7, 8, or 9.' };

  if (!email) return { field: 'email', message: 'Email is required.' };
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return { field: 'email', message: 'Email address is not in a valid format.' };

  if (occupation.length > 100) return { field: 'occupation', message: 'Occupation is too long.' };
  if (!residentType) return { field: 'residentType', message: 'Please select Owner, Joint Owner, or Tenant.' };
  if (!['owner', 'jointowner', 'tenant'].includes(residentType)) return { field: 'residentType', message: 'Invalid Owner/Tenant selection.' };

  // Photo is required (the committee uses it for on-site/gate verification);
  // Aadhaar/PAN stays optional — the office can add that later from the
  // member's edit screen, same as before.
  if (!f.photo || !f.photo.files || f.photo.files.length === 0) return { field: 'photo', message: 'Please upload a photo.' };

  if (f.password.value.length < 6) return { field: 'password', message: 'Password must be at least 6 characters.' };
  if (f.password.value !== f.confirmPassword.value) return { field: 'confirmPassword', message: 'Passwords do not match.' };
  if (!f.declaration.checked) return { field: 'declaration', message: 'Please check the declaration to continue.' };
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

/**
 * A severity read on one member's maintenance standing — richer than the
 * plain paid/unpaid duesFor() status, for a defaulters list a treasurer can
 * triage at a glance instead of treating every unpaid member the same.
 *
 * This maintenance rate is a single amount for the WHOLE financial year
 * (expectedDue() above), not a monthly bill — there's no per-month due date
 * to count "months behind" against the way a rent ledger would. So instead
 * of months-overdue, severity among unpaid members is read off how far into
 * the financial year we've gotten with nothing paid at all: unpaid two
 * months after the FY opened is routine; unpaid with the year mostly gone
 * is the case that actually needs escalating.
 *
 * "Disputed" is never inferred — it only appears when a treasurer has
 * explicitly flagged the member's dues as under review (member.duesDisputed),
 * which the automatic paid/unpaid math should never override.
 */
export function maintenanceHealthStatus(member, payments, financialYear, maintenanceSettings) {
  if (member?.duesDisputed) return { level: 'disputed', label: 'Disputed', icon: '⚫' };
  const d = duesFor(member, payments, financialYear, maintenanceSettings);
  if (d.status === 'no_rate') return { level: 'no_rate', label: 'Rate Not Set', icon: '⚪', ...d };
  if (d.outstanding === 0) return { level: 'current', label: 'Paid Current', icon: '🟢', ...d };
  if (d.status === 'partial') return { level: 'partial', label: 'Partially Paid', icon: '🟡', ...d };

  // From here, status is 'unpaid' (paid === 0) — grade by how much of the
  // FY has passed. FY is assumed to start 1 April, matching
  // currentFinancialYear() elsewhere in this file.
  const fyStartYear = parseInt(String(financialYear).split('-')[0], 10);
  const fyStart = new Date(fyStartYear, 3, 1);
  const now = new Date();
  const monthsIn = (now.getFullYear() - fyStart.getFullYear()) * 12 + (now.getMonth() - fyStart.getMonth());
  if (monthsIn <= 2) return { level: 'due', label: 'Due', icon: '🟡', ...d };
  if (monthsIn <= 5) return { level: 'reminder', label: '1–2 Months', icon: '🟠', ...d };
  return { level: 'serious', label: '3+ Months', icon: '🔴', ...d };
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
  // Deliberately NOT hardcoded: this file is a static asset served to every
  // visitor's browser regardless of any Firestore rule, so a real account
  // number or IFSC placed here would be exposed even if Firestore locked
  // paymentPrivate down perfectly. The real values live only in
  // settings/paymentPrivate, configured once from the admin Settings page —
  // an empty string here just means "not configured yet" instead of
  // silently showing what looks like a valid, real account.
  accountNumber: '',
  accountType: 'Current Account',
  ifsc: '',
  branch: '',
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

/* ---------------------------------------------------------------------- */
/*  Event fees (Diwali, Ganesh Puja, annual function, etc.)                */
/*                                                                          */
/*  The treasurer creates an "event" with a flat fee and activates it; each */
/*  approved resident then owes that fee once. A payment counts toward an   */
/*  event when its `type` is 'event' and its `eventId` matches. Same shape  */
/*  as membershipDue so the resident UI can treat all three the same way.   */
/* ---------------------------------------------------------------------- */
export function eventPaid(payments, memberUid, eventId) {
  return (payments || [])
    .filter(p => p.memberUid === memberUid
              && p.status === 'verified'
              && p.type === 'event'
              && p.eventId === eventId)
    .reduce((sum, p) => sum + (Number(p.amount) || 0), 0);
}

export function eventDue(member, payments, event) {
  const fee = Number(event?.feeAmount) || 0;
  const paid = eventPaid(payments, member?.uid, event?.id);
  const outstanding = Math.max(0, fee - paid);
  return { eventId: event?.id, name: event?.name || 'Event', fee, paid, outstanding, cleared: outstanding === 0 };
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
  // Only money that's actually final counts as "spent": approved expenses,
  // and anything written before the Approval Workflow existed (no status
  // field at all — treated as legacy-approved). A pending request, a
  // rejected one, or one later voided must NOT inflate this total, or Fund
  // Balance and the Treasurer Dashboard would overstate what's really gone.
  const rows = (expenses || []).filter(e =>
    e.financialYear === financialYear
    && e.status !== 'pending_approval'
    && e.status !== 'rejected'
    && e.status !== 'voided'
  );
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

// Cash-in-hand always means physical currency the treasurer is personally
// holding; every other mode (cheque, UPI, netbanking, bank transfer)
// eventually settles into the bank account, so it counts as "bank" for this
// split even though a cheque takes a few days to clear. That's a
// reasonable approximation without a real bank-reconciliation feed —
// exact only once Bank Reconciliation (a separate, larger feature) exists
// to match against the actual statement.
const CASH_MODE = 'cash';

/** Treasurer Dashboard figures — cash/bank split (across all verified
 * payments and all recorded expenses ever, not scoped to one FY, since a
 * balance is a running total) plus this-calendar-month collection and
 * spend. Deliberately does NOT compute "outstanding maintenance" here —
 * that needs the members list and maintenance rates, which this
 * payments/expenses-only helper doesn't have; callers already have
 * outstandingMembers() for that and should combine the two. */
export function treasurerDashboardStats(payments, expenses) {
  const verified = (payments || []).filter(p => p.status === 'verified');
  // Same approved-or-legacy filter as expenseSummary() — a pending or
  // rejected expense request hasn't actually left the account yet.
  const finalExpenses = (expenses || []).filter(e => e.status !== 'pending_approval' && e.status !== 'rejected');
  const cashIn = verified.filter(p => p.mode === CASH_MODE).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const bankIn = verified.filter(p => p.mode !== CASH_MODE).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const cashOut = finalExpenses.filter(e => e.mode === CASH_MODE).reduce((s, e) => s + (Number(e.amount) || 0), 0);
  const bankOut = finalExpenses.filter(e => e.mode !== CASH_MODE).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  const now = new Date();
  const inThisMonth = (tsLike) => {
    const d = tsLike?.toDate ? tsLike.toDate() : (tsLike ? new Date(tsLike) : null);
    return d && d.getFullYear() === now.getFullYear() && d.getMonth() === now.getMonth();
  };
  const thisMonthCollection = verified.filter(p => inThisMonth(p.verifiedAt || p.submittedAt)).reduce((s, p) => s + (Number(p.amount) || 0), 0);
  const thisMonthExpenses = finalExpenses.filter(e => inThisMonth(e.date)).reduce((s, e) => s + (Number(e.amount) || 0), 0);

  return {
    cashBalance: cashIn - cashOut,
    bankBalance: bankIn - bankOut,
    totalBalance: (cashIn - cashOut) + (bankIn - bankOut),
    thisMonthCollection, thisMonthExpenses,
    monthSurplus: thisMonthCollection - thisMonthExpenses
  };
}

/** Validates an expense before it is written. Mirrors the security rules. */
export function validateExpense({ description, amount, category, mode, paidTo }) {
  const amt = Number(amount);
  if (!String(description || '').trim()) return 'Expense description is required.';
  if (String(description).length > 200) return 'Description is too long.';
  if (!Number.isFinite(amt) || amt <= 0) return 'Please enter a valid amount.';
  if (amt > 10000000) return 'Amount cannot exceed ₹1,00,00,000.';
  if (!EXPENSE_CATEGORIES.includes(category)) return 'Invalid category.';
  if (!EXPENSE_MODES.includes(mode)) return 'Invalid payment mode.';
  if (String(paidTo || '').length > 120) return 'Paid To name is too long.';
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

/* escapeHtml alone makes a URL safe to PRINT (can't break out of the href
   attribute) but says nothing about what the URL actually DOES — an admin
   pasting `javascript:alert(document.cookie)` as a bill link or document
   URL would escape just fine and still execute when another admin clicks
   it. This is checked at save time (not just render time) precisely so a
   bad value can't slip through some future render site that forgets to
   re-check it — the data itself is never allowed to carry a dangerous
   scheme in the first place. Returns '' for anything that isn't a
   well-formed absolute http(s) URL. */
export function sanitizeUrl(url) {
  if (typeof url !== 'string') return '';
  const trimmed = url.trim();
  if (!trimmed) return '';
  try {
    const parsed = new URL(trimmed);
    if (parsed.protocol === 'https:' || parsed.protocol === 'http:') return trimmed;
  } catch { /* not a well-formed absolute URL at all */ }
  return '';
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

/* One flat now has TWO independent claim slots — owner-side and
   tenant-side — not one. This is deliberate: an out-of-town owner who
   rents their flat out may still want their own portal login (to see
   notices, vote, track their own dues) alongside the tenant who actually
   lives there and handles day-to-day matters. jointowner shares the SAME
   owner-side slot as owner (a flat has one owner-side registration,
   however that ownership is structured) — it does not create a third slot.
   Passing a residentType of 'owner', 'jointowner', or 'tenant' picks the
   right slot automatically; any other/missing value falls back to the old
   single-slot ID so a caller that doesn't yet know about a resident's type
   still gets a stable, valid ID rather than a crash. */
/* ==========================================================================
   Facility inspection checklists — ported from the standalone MHM Inspection
   PWA (maxapp). Content is copied faithfully (same section titles and item
   wording) since it reflects real domain knowledge already worked out for
   this specific society; only the SHAPE was adapted to fit as one shared
   export instead of that app's own global.

   'daily-tower' is structured differently on purpose (floor-by-floor items
   repeated per floor, plus a flat "additional" list) — that's how the
   source app modelled it, not an inconsistency to "fix" here.
   ========================================================================== */
export const INSPECTION_TYPES = {
  'daily-tower': {
    label: 'Daily Tower Common Area',
    floors: ['Ground', 'First', 'Second', 'Third', 'Fourth', 'Fifth', 'Sixth', 'Seventh', 'Eighth', 'Ninth', 'Tenth', 'Eleventh', 'Twelfth', 'Thirteenth'],
    floorItems: ['Corridor Clean', 'Staircase Clean', 'Lift Clean', 'Lift Working', 'Fire System OK', 'Meter Room OK', 'Common Lights', 'Walls & Ceiling OK', 'Signages OK', 'Housekeeping Done', 'No Water Seepage', 'Emergency Exit Clear'],
    additional: ['Terrace Clean', 'Basement Housekeeping', 'Parking Area', 'Garbage Room', 'No Pest Activity']
  },
  'weekly-mep': {
    label: 'Weekly MEP Inspection',
    sections: {
      A: { title: 'Water Supply System', items: ['Borewell Pump Working', 'Pump Motors Condition', 'Auto Operation', 'Pressure Gauges', 'Delivery Pressure', 'Pump Leakage', 'Pump Foundation & Vibration', 'NRV & Valves', 'Underground Tank Clean', 'Underground Tank Water Level', 'Terrace Tank Water Level', 'Overflow System', 'Tank Cover Locked', 'Vent Mesh Available', 'Water Colour', 'Water Odour', 'Water Distribution to All Towers', 'Water Meter Reading Recorded'] },
      C: { title: 'Electrical System', items: ['Transformer', 'HT Panel', 'LT Panel', 'DG Set', 'DG Set Fuel Level', 'AMF Panel', 'Earthing System', 'Electrical Room Housekeeping', 'Panel Temperature', 'Common Area Lighting', 'Podium Lights Working', 'Podium Decorative Lights Working', 'Entry Gate Lights Working', 'Exit Gate Lights Working', 'Basement Lighting', 'Terrace Lighting', 'Emergency Lights'] },
      D: { title: 'Fire Fighting System', items: ['Fire Pump', 'Diesel Pump', 'Jockey Pump', 'Fire Panel', 'Hydrant Pressure', 'Hose Boxes', 'Hose Pipes', 'Fire Extinguishers', 'Fire Alarm System', 'Smoke Detectors'] },
      E: { title: 'STP (Sewage Treatment Plant)', items: ['Raw Sewage Pump', 'Equalization Tank', 'Blowers', 'Clarifier', 'Sludge Pump', 'Chlorine Dosing', 'Treated Water Quality', 'Reuse Pump', 'STP Housekeeping', 'Chemical Stock'] },
      F: { title: 'Basement & Service Areas', items: ['Pump Room Housekeeping', 'Electrical Room', 'STP Room', 'DG Room', 'Lift Machine Room Checked', 'Parking Drainage', 'Water Leakage', 'Seepage', 'Ventilation'] },
      G: { title: 'Open Gym & Kids Play Area', items: ['Open Gym - All equipment structurally stable (no wobble / loose parts)', 'Open Gym - Moving parts operate smoothly (no jamming / grinding)', 'Open Gym - All bolts, nuts & fasteners tight, none missing', 'Open Gym - No sharp edges, broken welds or cracked metal', 'Open Gym - Paint / coating intact, no rust patches exposed', 'Open Gym - Rubber / foam grips in good condition', 'Open Gym - Flooring / rubber mat clean and intact', 'Open Gym - Area clean, no litter or hazard', 'Open Gym - Signage / usage instructions visible', 'Kids Play - All equipment structurally stable (no tilting / sinking)', 'Kids Play - Swing chains, ropes & hooks intact, no fraying', 'Kids Play - Slide surface smooth, no cracks or sharp edges', 'Kids Play - See-saw pivot balanced and secure', 'Kids Play - All bolts & fasteners tight, none protruding', 'Kids Play - No broken or missing components on any equipment', 'Kids Play - Rubber / soft fall-zone flooring intact', 'Kids Play - Area fencing / boundary secure', 'Kids Play - Area clean and litter-free'] },
      H: { title: 'Gardening & Landscaping', items: ['Podium Garden - Plants Watered & Healthy', 'Podium Garden - Dry/Dead Plants Removed', 'Podium Garden - Mulching Done', 'Podium Garden - Lawn Mowed & Edged', 'Podium Garden - Weeds Removed', 'Podium Garden - Fertilizer / Manure Applied', 'Open Parking - Planters Clean & Watered', 'Open Parking - Boundary Shrubs Trimmed', 'Open Parking - No Overgrowth on Walls', 'Open Parking - Lawn Patches Maintained', 'Club House - Garden Area Clean', 'Club House - Plants Healthy & Watered', 'Club House - Potted Plants Condition', 'Club House - Flower Beds Maintained', 'Entry Gate - Planters Watered & Clean', 'Entry Gate - Shrubs Trimmed', 'Exit Gate - Planters Watered & Clean', 'Exit Gate - Shrubs Trimmed', 'Open Gym Area - Ground Cover Plants OK', 'Open Gym Area - Surrounding Shrubs Trimmed'] }
    }
  },
  'daily-security': {
    label: 'Daily Security & Common Area',
    sections: {
      A: { title: 'Main Gate & Security Area', items: ['Main Gate Clean', 'Security Cabin / Guard Room Clean', 'Visitor Register Updated', 'Visitor Entry Process Followed', 'RFID System Working', 'Boom Barrier Working', 'Entry & Exit Gates Working', 'Security Lighting Working', 'Security Signage Proper', 'Guard Attendance Complete', 'Guards in Proper Uniform & ID Card', 'Fire Extinguisher Available', 'Intercom / Emergency Panel Working', 'Delivery / Courier Log Maintained'] },
      B: { title: 'Podium & Open Common Areas', items: ['Podium Clean', 'Walking Track Clean', 'Garden Area Clean', 'Lawn Properly Maintained', 'Plants Watered', 'Dry Leaves Removed', 'Benches Clean', 'Dustbins Clean', 'Garden Lights Working', 'Decorative Lights Working', "Children's Play Area Clean", 'Play Equipment Safe', 'Boundary Wall / Fencing Intact'] },
      C: { title: 'Basement', items: ['Basement Floor Clean', 'Parking Area Clean', 'Ramp Clean', 'Drainage Clean', 'No Water Leakage', 'No Oil Leakage', 'Basement Lights Working', 'Emergency Lights Working', 'Exit Sign Boards', 'Fire Exit Accessible'] },
      D: { title: 'CCTV Surveillance System', items: ['Main Gate Cameras', 'Basement Cameras', 'Podium Cameras', 'Parking Cameras', 'Boundary Wall Cameras', 'Recording System (NVR/DVR) Working', 'Camera Recording Available', 'Date & Time Synchronization', 'Storage Capacity Available'] },
      E: { title: 'Common Toilets', items: ['Toilet Clean', 'Wash Basin Clean', 'Water Available', 'Flush Working', 'Exhaust Fan Working', 'Lights Working', 'Hand Wash / Soap Available', 'Tissue Paper Available', 'No Bad Odour'] },
      F: { title: 'General Housekeeping', items: ['Sweeping Completed', 'Mopping Completed', 'Garbage Collected', 'Garbage Collection Area Clean', 'Dustbin Cleaned', 'Housekeeping Staff Present', 'Uniform & ID Cards Worn'] }
    }
  },
  'club-house': {
    label: 'Club House Daily Operations',
    sections: {
      A: { title: 'Morning Opening Checklist', items: ['Club House Opened On Time', 'Main Door Locks Checked', 'CCTV Working', 'Entry Register Available', 'Emergency Contact Displayed'] },
      B: { title: 'Housekeeping', items: ['Gym Cleaned', 'Pool Area Cleaned', 'Sauna Cleaned', 'Banquet Hall Checked', 'Washrooms Cleaned', 'Dustbins Emptied'] },
      C: { title: 'Maintenance', items: ['Lights Working', 'Water Supply Checked', 'Pool Pump Working', 'AC Working', 'Fire Extinguisher Available'] },
      D: { title: 'Swimming Pool Checklist', items: ['Water Level Checked', 'Water Clear & Clean', 'Pool Deck Cleaned', 'Shower Area Cleaned', 'Life Ring Available', 'First Aid Box Available', 'Pool Timing Board Displayed'] },
      E: { title: 'Gym Checklist', items: ['All Machines Working', 'AC Operational', 'Sanitization Done', 'Music System Working', 'Mirrors Clean', 'Drinking Water Available'] },
      F: { title: 'Banquet Hall Checklist', items: ['Hall Clean', 'Furniture Properly Arranged', 'Lights Working', 'AC Working', 'Washrooms Clean', 'No Damage Found'] },
      G: { title: 'Evening Closing Checklist', items: ['Residents Vacated Facility', 'Lights Switched Off', 'AC Switched Off', 'Pool Area Secured', 'Gym Locked', 'Banquet Hall Locked', 'CCTV Operational', 'Main Gate Locked'] }
    }
  }
};

// A small, deliberately conservative subset — fire/life-safety and exit
// access only — ported from the source app's own CRITICAL_ITEMS set. A
// flagged item in this set becomes a 'high' priority complaint (24h SLA)
// instead of 'medium' (72h); everything else defaults to medium so this
// list doesn't need to be exhaustive to be useful.
export const INSPECTION_CRITICAL_ITEMS = new Set([
  'Fire System OK', 'Fire Pump', 'Diesel Pump', 'Jockey Pump', 'Fire Panel', 'Hydrant Pressure',
  'Hose Boxes', 'Hose Pipes', 'Fire Extinguishers', 'Fire Extinguisher Available', 'Fire Alarm System', 'Smoke Detectors',
  'Emergency Lights', 'Emergency Lights Working', 'Fire Exit Accessible', 'Exit Sign Boards',
  'Boom Barrier Working', 'Emergency Exit Clear', 'Intercom / Emergency Panel Working'
]);

// Maps an inspection section/context to one of the 8 complaint categories
// this app already has (see firestore.rules' complaints.create) — a flagged
// checklist item becomes a normal complaint via this mapping rather than a
// parallel category system just for inspections.
// How often each inspection type is expected, and whether it's filed once
// society-wide or once per tower. Drives the "what's due / what's been
// missed" scheduler in the admin panel. Ported from the inspection app,
// where daily-tower was the only per-tower one and MEP was weekly.
// Staff trades — the kind of work a staff member does, separate from their
// role (manager/supervisor, which is the permission level). 'general' is the
// fallback for someone not tied to one trade (e.g. a Managing Staff who just
// triages). The category is the complaint category this trade usually
// handles, used to suggest the right person when assigning.
export const STAFF_TRADES = {
  plumber:     { label: 'Plumber',     category: 'plumbing' },
  electrician: { label: 'Electrician', category: 'electrical' },
  stp:         { label: 'STP Operator', category: 'plumbing' },
  carpenter:   { label: 'Carpenter',   category: 'maintenance' },
  cleaning:    { label: 'Cleaning',    category: 'housekeeping' },
  civil:       { label: 'Civil',       category: 'maintenance' },
  guard:       { label: 'Guard',       category: 'security' },
  gardener:    { label: 'Gardener',    category: 'housekeeping' },
  general:     { label: 'General',     category: null }
};

export const INSPECTION_SCHEDULE = {
  'daily-tower':    { frequency: 'daily',  perTower: true },
  'daily-security': { frequency: 'daily',  perTower: false },
  'club-house':     { frequency: 'daily',  perTower: false },
  'weekly-mep':     { frequency: 'weekly', perTower: false }
};

export function inspectionSectionToComplaintCategory(sectionTitle) {
  const t = String(sectionTitle || '').toLowerCase();
  if (t.includes('security') || t.includes('gate') || t.includes('cctv')) return 'security';
  if (t.includes('housekeeping') || t.includes('toilet') || t.includes('clean')) return 'housekeeping';
  if (t.includes('electrical') || t.includes('lighting') || t.includes('light')) return 'electrical';
  if (t.includes('water supply') || t.includes('sewage') || t.includes('stp') || t.includes('pool')) return 'plumbing';
  if (t.includes('parking') || t.includes('basement')) return 'parking';
  return 'maintenance';
}

// Calendar date as YYYY-MM-DD in the DEVICE's own local timezone.
// Deliberately NOT `date.toISOString().slice(0, 10)` — that converts to
// UTC first, so for India (UTC+5:30) it silently returns YESTERDAY's date
// for any local time before 5:30 AM (booking/guest-date minimums, "today"
// comparisons, and Excel-import date normalisation all used that pattern
// until this was added).
export function dateToLocalISO(d) {
  if (!(d instanceof Date) || Number.isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
export function todayLocalISO() {
  return dateToLocalISO(new Date());
}

export function flatClaimId(tower, flatNumber, residentType) {
  const base = `${String(tower || '').trim()}_${String(flatNumber || '').trim()}`;
  const slot = residentType === 'tenant' ? 'tenant' : (residentType === 'owner' || residentType === 'jointowner') ? 'owner' : null;
  return slot ? `${base}_${slot}` : base;
}

/* Used by the gate-security visitor log (guards/{uid}, visitors/{id} in
   firestore.rules) so a resident's live query and a guard's write agree on
   exactly the same key for "this household" — deliberately NOT the same
   string as flatClaimId() above, which is further split by residentType
   (owner slot vs tenant slot); a visitor at the gate is for the whole
   flat, everyone living there, regardless of who is the owner and who is
   the tenant. */
export function flatKey(tower, flatNumber) {
  return `${String(tower || '').trim()}_${String(flatNumber || '').trim()}`;
}

/* A flat has two independent slots (owner-side, tenant-side) as of the
   dual-registration change — see flatClaimId's own comment for why. This
   is the one place that decides "is the slot this residentType wants
   actually free", and it has to stay conservative about data that predates
   the change: a legacy claim (flatClaims/A_101, no side suffix, from
   before a flat could have two residents) is treated as occupying BOTH
   slots — not just whichever side its owner happens to be — until an admin
   touches that member's record again (Master Data Edit's save recreates
   the claim under the new per-side ID as a side effect, which is what
   actually "migrates" it). The alternative — guessing a legacy claim only
   blocks its own side — risks a false negative: approving a second
   resident for a flat that, as far as this app can prove, may already be
   fully occupied under the old model.
   Returns null if the slot is free, or the existing claim's data if it's
   taken (by someone other than excludeMemberId, so a member's own
   re-approval or a same-person data edit never blocks itself). */
export async function findBlockingFlatClaim(tower, flatNumber, residentType, excludeMemberId) {
  const legacyRef = doc(db, 'flatClaims', flatClaimId(tower, flatNumber, null));
  const legacySnap = await getDoc(legacyRef);
  if (legacySnap.exists() && legacySnap.data().memberDocId !== excludeMemberId) {
    return legacySnap.data();
  }
  const sidedRef = doc(db, 'flatClaims', flatClaimId(tower, flatNumber, residentType));
  const sidedSnap = await getDoc(sidedRef);
  if (sidedSnap.exists() && sidedSnap.data().memberDocId !== excludeMemberId) {
    return sidedSnap.data();
  }
  return null;
}

export async function generateMemberId() {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`member_${year}`, 6);
  return `MHM-${year}-${seq}`;
}

/* Same atomic-counter pattern as generateMemberId — one shared, ever-
   increasing sequence per year, so two pets registered in the same second
   never collide. Useful on a collar tag, in complaint records, and in
   vaccination-reminder messages, where "the pet formerly known as Tommy at
   A-101" isn't a stable enough reference once a flat changes hands. */
export async function generatePetId() {
  const year = new Date().getFullYear();
  const seq = await nextSequence(`pet_${year}`, 4);
  return `MHM-PET-${year}-${seq}`;
}

export async function generateReceiptNumber(financialYear) {
  const yearPart = financialYear.split('-')[0];
  const seq = await nextSequence(`receipt_${financialYear}`, 6);
  return `MHMRWS-${yearPart}-${seq}`;
}

/**
 * Allocates the next receipt number AND performs the caller's own
 * payment/receipt writes in the SAME Firestore transaction as the counter
 * increment, instead of two separate operations.
 *
 * Without this, generateReceiptNumber() commits and returns on its own —
 * if the browser loses its connection in the gap right after that but
 * before the payment/receiptsPublic batch commits, the number it just
 * allocated is permanently burned (the counter has moved on, but no
 * payment record ever carries that number). Wrapping both in one
 * transaction makes them succeed or fail together: either the resident's
 * payment is verified AND that exact number is on it, or neither the
 * counter nor anything else moved at all.
 *
 * writeFn receives (tx, receiptNumber) and must call tx.set/tx.update for
 * whatever payment and receiptsPublic documents this specific call site
 * needs — it must NOT perform any tx.get() of its own (Firestore
 * transactions require every read to happen before any write, and the
 * counter read here already claims that slot).
 */
export async function generateReceiptNumberAtomic(financialYear, writeFn) {
  const yearPart = financialYear.split('-')[0];
  const counterRef = doc(db, 'counters', `receipt_${financialYear}`);
  return runTransaction(db, async (tx) => {
    const counterSnap = await tx.get(counterRef);
    const current = counterSnap.exists() ? (counterSnap.data().value || 0) : 0;
    const seq = current + 1;
    const receiptNumber = `MHMRWS-${yearPart}-${String(seq).padStart(6, '0')}`;
    tx.set(counterRef, { value: seq, updatedAt: serverTimestamp() }, { merge: true });
    writeFn(tx, receiptNumber);
    return receiptNumber;
  });
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

/* A user-chosen filename has no business becoming part of a Storage object
   key — not because Cloud Storage keys can be path-traversed (they're flat
   opaque strings, not real filesystem paths), but because a name with
   unusual characters, an excessive length, or something that happens to
   look like a control string is still something the app never needed to
   trust in the first place. This keeps only the extension (and only if it
   looks like one — 1-8 alphanumeric characters) and replaces the rest with
   the same random token used for public verification links. The original
   name, if worth keeping for display, is the caller's job to store
   separately as plain data (e.g. an originalName field), never as part of
   the key. */
export function safeStorageFilename(originalName) {
  const match = /\.([a-zA-Z0-9]{1,8})$/.exec(String(originalName || ''));
  const ext = match ? `.${match[1].toLowerCase()}` : '';
  return newPublicToken() + ext;
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
/* A confirmation of what was actually submitted — not a membership
   certificate. The status line says "Pending Approval" always, because
   this generates the moment the form is submitted, before any committee
   member has looked at it. Payment fields only render if a membership
   payment was actually submitted alongside registration (payment is
   optional at registration time — someone can register today and pay
   later without this document lying about what happened). */
export async function generateRegistrationConfirmationPDF({ formData, membershipPayment, society, logoDataUrl, save = true }) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const H = pdf.internal.pageSize.getHeight();
  const marginX = 48;
  let y = 56;

  pdf.setFillColor(10, 27, 51);
  pdf.rect(0, 0, W, 100, 'F');
  if (logoDataUrl) {
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
    } catch (e) {/* still a valid document without the seal */}
  }
  pdf.setTextColor(255, 255, 255);
  pdf.setFont('times', 'bold'); pdf.setFontSize(18);
  pdf.text(society.fullName || 'Resident Welfare Society', marginX + 64, 46);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(10);
  pdf.text(`Reg. No: ${society.regNumber || '—'}`, marginX + 64, 62);
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11);
  pdf.text('REGISTRATION CONFIRMATION', W - marginX, 46, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
  pdf.text(fmtDateTime(new Date()), W - marginX, 62, { align: 'right' });

  y = 128;
  pdf.setTextColor(16, 25, 43);

  // Status banner — amber, not green: nothing has been approved yet.
  pdf.setFillColor(255, 244, 229);
  pdf.roundedRect(marginX, y, W - marginX * 2, 34, 6, 6, 'F');
  pdf.setDrawColor(232, 163, 61); pdf.setLineWidth(1);
  pdf.roundedRect(marginX, y, W - marginX * 2, 34, 6, 6, 'S');
  pdf.setFont('helvetica', 'bold'); pdf.setFontSize(11); pdf.setTextColor(153, 90, 12);
  pdf.text('SUBMITTED — Pending Committee Approval', marginX + 14, y + 22);
  y += 54;

  function section(title) {
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5); pdf.setTextColor(10, 27, 51);
    pdf.text(title.toUpperCase(), marginX, y);
    pdf.setDrawColor(226, 230, 239); pdf.setLineWidth(0.6);
    pdf.line(marginX, y + 5, W - marginX, y + 5);
    y += 22;
  }
  function row(label, value) {
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(124, 135, 156);
    pdf.text(label, marginX, y);
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5); pdf.setTextColor(16, 25, 43);
    pdf.text(String(value ?? '—'), marginX + 165, y);
    y += 18;
  }

  const RESIDENT_TYPE_LABEL = { owner: 'Owner', jointowner: 'Joint Owner', tenant: 'Tenant' };

  section('Resident Details');
  row('Name', formData.name);
  row("Father's / Spouse's Name", formData.fatherHusbandName);
  row('Flat / Tower', `${formData.flatNumber || '—'} / ${formData.tower || '—'}`);
  row('Mobile', formData.mobile);
  row('Email', formData.email);
  if (formData.occupation) row('Occupation', formData.occupation);
  if (formData.bloodGroup) row('Blood Group', formData.bloodGroup);
  row('Resident Type', RESIDENT_TYPE_LABEL[formData.residentType] || formData.residentType);
  if (formData.coOwnerName) row("Co-Owner's Name", formData.coOwnerName);
  if (formData.coOwnerMobile) row("Co-Owner's Mobile", formData.coOwnerMobile);
  if (formData.coOwnerEmail) row("Co-Owner's Email", formData.coOwnerEmail);
  y += 8;

  if (formData.emergencyContactName || formData.emergencyContactPhone) {
    section('Emergency Contact');
    row('Name', formData.emergencyContactName || '—');
    row('Phone', formData.emergencyContactPhone || '—');
    y += 8;
  }

  if (formData.rentAgreementStart || formData.rentAgreementEnd || formData.policeVerification || formData.ownerName || formData.ownerContact) {
    section('Tenant Details');
    if (formData.rentAgreementStart || formData.rentAgreementEnd) {
      row('Rent Agreement', `${formData.rentAgreementStart ? fmtDate(formData.rentAgreementStart) : '—'} to ${formData.rentAgreementEnd ? fmtDate(formData.rentAgreementEnd) : '—'}`);
    }
    if (formData.policeVerification) {
      const PV_LABEL = { pending: 'Pending', submitted: 'Submitted to police station', not_applicable: 'Not applicable', verified: 'Verified', rejected: 'Rejected' };
      row('Police Verification', PV_LABEL[formData.policeVerification] || formData.policeVerification);
    }
    if (formData.ownerName) row("Owner's Name", formData.ownerName);
    if (formData.ownerContact) row("Owner's Contact", formData.ownerContact);
    y += 8;
  }

  if (Array.isArray(formData.vehicles) && formData.vehicles.length) {
    section('Vehicles');
    formData.vehicles.forEach(v => row(v.vehicleNumber, v.parkingSlot ? `Parking: ${v.parkingSlot}` : 'No parking slot recorded'));
    y += 8;
  }

  if (Array.isArray(formData.familyMembers) && formData.familyMembers.length) {
    section('Family Members');
    formData.familyMembers.forEach(fm => row(fm.name, fm.relation || '—'));
    y += 8;
  }

  if (Array.isArray(formData.pets) && formData.pets.length) {
    section('Pets');
    formData.pets.forEach(p => row(p.name, [p.species === 'other' ? p.speciesOther : p.species, p.breed].filter(Boolean).join(' · ') || '—'));
    y += 8;
  }

  if (membershipPayment) {
    section('Membership Fee Payment');
    row('Amount', formatINR(membershipPayment.amount));
    row('Mode', (membershipPayment.mode || '').toUpperCase());
    row('Transaction / UTR No.', membershipPayment.utrOrChequeNo || '—');
    row('Status', 'Submitted — Pending Verification');
    y += 8;
  }

  // Disclaimer — pinned near the bottom of the page, not wherever the
  // content happened to end, so it reads the same on every registration
  // regardless of how many optional sections were filled in.
  const discY = H - 110;
  pdf.setDrawColor(226, 230, 239); pdf.setLineWidth(0.6);
  pdf.line(marginX, discY, W - marginX, discY);
  pdf.setFont('helvetica', 'italic'); pdf.setFontSize(8); pdf.setTextColor(124, 135, 156);
  const disclaimer = 'Disclaimer: This is a system-generated acknowledgement of the information submitted and does not, by itself, confirm membership or approve any payment. Membership becomes effective only once a committee member has reviewed and approved this registration; a submitted payment is credited only after independent verification by the Treasurer. Please retain this document for your records and quote the details above in any correspondence with the society office.';
  const wrapped = pdf.splitTextToSize(disclaimer, W - marginX * 2);
  pdf.text(wrapped, marginX, discY + 16);

  if (save) pdf.save(`Registration_${(formData.name || 'Resident').replace(/\s+/g, '_')}.pdf`);
  return pdf;
}

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

/** Society-wide Income & Expenditure statement for a financial year — the
 * document a treasurer hands to the AGM or a CA, not a single resident's
 * receipt trail. Mirrors generateStatementPDF's exact visual language (same
 * navy header, gold accents, table style) so the two documents look like
 * they came from the same portal, but reshapes the content: income broken
 * down by payment type (maintenance / membership / event) instead of a
 * payment-by-payment ledger, and expenditure by category — matching how a
 * committee actually thinks about "where the money came from and went",
 * not a raw transaction log. */
export async function generateIncomeExpenditurePDF({ payments, expenses, society, financialYear, logoDataUrl, save = true }) {
  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF({ unit: 'pt', format: 'a4' });
  const W = pdf.internal.pageSize.getWidth();
  const marginX = 48;

  const verified = (payments || []).filter(p => p.status === 'verified' && p.financialYear === financialYear);
  const incomeByType = {};
  verified.forEach(p => {
    const k = p.type === 'membership' ? 'Membership Fees' : p.type === 'event' ? 'Event Collections' : 'Maintenance';
    incomeByType[k] = (incomeByType[k] || 0) + (Number(p.amount) || 0);
  });
  const incomeRows = Object.entries(incomeByType).sort((a, b) => b[1] - a[1]);
  const totalIncome = incomeRows.reduce((s, [, amt]) => s + amt, 0);

  const expSummary = expenseSummary(expenses, financialYear);
  const expenseRows = expSummary.categories;   // already sorted, largest first
  const totalExpenditure = expSummary.total;
  const net = totalIncome - totalExpenditure;

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
    pdf.text('INCOME & EXPENDITURE STATEMENT', W - marginX, 46, { align: 'right' });
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9);
    pdf.text(`For the Financial Year ${financialYear}`, W - marginX, 62, { align: 'right' });
  };
  await drawHeader();

  let y = 128;
  const colLabel = marginX, colAmount = W - marginX;

  const sectionHeading = (text) => {
    pdf.setFillColor(245, 246, 250);
    pdf.rect(marginX, y, W - marginX * 2, 22, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(9.5); pdf.setTextColor(70, 80, 102);
    pdf.text(text, colLabel + 8, y + 15);
    y += 22;
  };
  const dataRow = (label, amount, opts = {}) => {
    if (y > 760) { pdf.addPage(); y = 60; }
    pdf.setFont('helvetica', opts.bold ? 'bold' : 'normal');
    pdf.setFontSize(10.5); pdf.setTextColor(16, 25, 43);
    pdf.text(label, colLabel + 8, y + 16);
    pdf.text(formatINR(amount), colAmount - 8, y + 16, { align: 'right' });
    pdf.setDrawColor(236, 239, 245); pdf.setLineWidth(0.5);
    pdf.line(marginX, y + 22, W - marginX, y + 22);
    y += 24;
  };
  const subtotalRow = (label, amount) => {
    pdf.setFillColor(250, 247, 235);
    pdf.rect(marginX, y, W - marginX * 2, 24, 'F');
    pdf.setFont('helvetica', 'bold'); pdf.setFontSize(10.5); pdf.setTextColor(16, 25, 43);
    pdf.text(label, colLabel + 8, y + 16);
    pdf.text(formatINR(amount), colAmount - 8, y + 16, { align: 'right' });
    y += 34;
  };

  // INCOME
  sectionHeading('INCOME');
  if (incomeRows.length) incomeRows.forEach(([label, amt]) => dataRow(label, amt));
  else dataRow('No verified income recorded for this FY', 0);
  subtotalRow('TOTAL INCOME', totalIncome);

  // EXPENDITURE
  sectionHeading('EXPENDITURE');
  if (expenseRows.length) expenseRows.forEach(c => dataRow(c.name, c.amount));
  else dataRow('No expenses recorded for this FY', 0);
  subtotalRow('TOTAL EXPENDITURE', totalExpenditure);

  // Net surplus/deficit band — same gold-on-navy treatment as the payment
  // statement's total band, so the two documents read as one family.
  if (y > 700) { pdf.addPage(); y = 60; }
  pdf.setFillColor(10, 27, 51);
  pdf.roundedRect(marginX, y, W - marginX * 2, 46, 8, 8, 'F');
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(228, 199, 101);
  pdf.text(net >= 0 ? 'NET SURPLUS' : 'NET DEFICIT', marginX + 16, y + 20);
  pdf.setFont('times', 'bold'); pdf.setFontSize(18); pdf.setTextColor(255, 255, 255);
  pdf.text(formatINR(Math.abs(net)), W - marginX - 16, y + 30, { align: 'right' });
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8); pdf.setTextColor(180, 190, 205);
  pdf.text('Income minus Expenditure for the year', marginX + 16, y + 34);
  y += 70;

  // Signature blocks — this is the one document in the portal meant to be
  // physically signed and read out at an AGM, so it gets the three blank
  // signature lines a printed financial statement traditionally carries.
  if (y > 700) { pdf.addPage(); y = 60; }
  const sigW = (W - marginX * 2 - 40) / 3;
  ['President', 'Treasurer', 'Secretary'].forEach((role, i) => {
    const x = marginX + i * (sigW + 20);
    pdf.setDrawColor(160, 170, 190); pdf.setLineWidth(0.6);
    pdf.line(x, y + 36, x + sigW, y + 36);
    pdf.setFont('helvetica', 'normal'); pdf.setFontSize(9); pdf.setTextColor(124, 135, 156);
    pdf.text(role, x, y + 50);
  });
  y += 80;

  // Footer
  pdf.setDrawColor(226, 230, 239); pdf.setLineWidth(0.6);
  pdf.line(marginX, y, W - marginX, y);
  pdf.setFont('helvetica', 'normal'); pdf.setFontSize(8.5); pdf.setTextColor(124, 135, 156);
  pdf.text('This is a system-generated statement from the MHMRWS Digital Portal, for AGM presentation and internal record.', marginX, y + 16);
  pdf.text(`Generated on ${fmtDate(new Date())}. Figures are drawn from verified payments and recorded expenses only.`, marginX, y + 28);

  if (save) {
    deliverPdf(pdf, `Income-Expenditure-FY${financialYear}.pdf`);
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
    banner.innerHTML = `<span>For your security, you'll be logged out in <b class="sec">${left}</b> seconds.</span>
      <button class="stay">Stay Logged In</button>
      <button class="out">Log Out Now</button>`;
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

export async function generateMembershipCard({ member, society, logoDataUrl, financialYear, officeAddress, familyMember = null }) {
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
  value(String((familyMember?.name || member.name || '')).slice(0, 26), 22.4, 9);

  label('TOWER / FLAT', 27.6);
  value(`${member.tower || '—'}  ·  ${member.flatNumber || '—'}`, 31.6, 7.6);

  pdf.setFont('courier','normal'); pdf.setFontSize(3.9); pdf.setTextColor(185,196,212);
  pdf.text(familyMember ? 'RELATION' : 'STATUS', dx + 26, 27.6);
  pdf.setFont('helvetica','bold'); pdf.setFontSize(7.6); pdf.setTextColor(255,255,255);
  pdf.text((familyMember ? (familyMember.relation || '—') : (member.residentType || '—')).replace(/^\w/, c => c.toUpperCase()), dx + 26, 31.6);

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
  const displayID = familyMember ? `${member.memberID || '—'}-${familyMember.suffix || 'F1'}` : String(member.memberID || '—');
  pdf.text(displayID, M, CARD_H - 2.6);

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
  const filename = familyMember
    ? `MHMRWS-Card-${member.memberID || 'member'}-${familyMember.suffix || 'F1'}.pdf`
    : `MHMRWS-Card-${member.memberID || 'member'}.pdf`;
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

/* Download any image URL (e.g. the society's UPI QR code, usually a Firebase
   Storage link) straight to the visitor's device. A plain <a download> often
   gets ignored for cross-origin images — many mobile browsers just open the
   image in a new tab instead of saving it. Fetching it as a blob first and
   downloading THAT is what actually triggers a save dialog / gallery write
   consistently, so someone can keep the QR on their phone and scan it later
   from a second device or a photo app, without needing to be online. */
export async function downloadImageFromUrl(url, filename) {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`fetch failed: ${res.status}`);
    const blob = await res.blob();
    const blobUrl = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = blobUrl;
    a.download = filename;
    a.rel = 'noopener';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => { try { URL.revokeObjectURL(blobUrl); } catch (_) {} }, 60000);
    return true;
  } catch (e) {
    // CORS or offline — fall back to opening the image directly; the visitor
    // can still long-press / use the browser's own "save image" from there.
    try { window.open(url, '_blank', 'noopener'); return true; }
    catch (e2) { return false; }
  }
}

/* ---------------------------------------------------------------------- */
/*  Excel export / import (uses SheetJS — window.XLSX)                    */
/* ---------------------------------------------------------------------- */
export function exportToExcel(rows, filename = 'export.xlsx', sheetName = 'Sheet1') {
  if (!rows || !rows.length) { showToast('No data found to export.', 'error'); return; }
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
    throw new Error('Google OAuth Client ID is not configured yet. See Step 5 of SETUP-GUIDE.md.');
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

/* ---------------------------------------------------------------------- */
/*  Family members editor — dynamic add/remove rows (name, relation, DOB)   */
/*                                                                          */
/*  Shared by the public registration form, the admin "Register Resident"   */
/*  form, and the admin "Edit Member" form, so the row markup, add/remove    */
/*  wiring, and read-back logic live in exactly one place.                  */
/* ---------------------------------------------------------------------- */
export const FAMILY_RELATIONS = ['Spouse', 'Son', 'Daughter', 'Father', 'Mother', 'Brother', 'Sister', 'Other'];

function familyMemberRowHTML(fm = {}) {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const relOptions = FAMILY_RELATIONS.map(r => `<option value="${r}" ${fm.relation === r ? 'selected' : ''}>${r}</option>`).join('');
  return `
    <div class="fm-row-wrap">
      <div class="fm-row">
        <input type="text" class="fm-name" placeholder="Name" maxlength="100" value="${esc(fm.name)}">
        <select class="fm-relation">${relOptions}</select>
        <input type="date" class="fm-dob" title="Date of Birth" value="${esc(fm.dob)}">
        <button type="button" class="fm-remove" aria-label="Remove family member">✕</button>
      </div>
      <div class="fm-minor-badge" style="display:none;">⚠️ Minor</div>
    </div>`;
}

/* Live, not something the person has to work out themselves: age is
   computed from the DOB they just entered, not asked as a separate
   "Minor?" field that could quietly disagree with it. */
function updateMinorBadge(row) {
  const badge = row.parentElement?.querySelector('.fm-minor-badge');
  const dobVal = row.querySelector('.fm-dob')?.value;
  if (!badge) return;
  if (!dobVal) { badge.style.display = 'none'; return; }
  const dob = new Date(dobVal);
  const now = new Date();
  let age = now.getFullYear() - dob.getFullYear();
  const monthDiff = now.getMonth() - dob.getMonth();
  if (monthDiff < 0 || (monthDiff === 0 && now.getDate() < dob.getDate())) age--;
  badge.style.display = (age >= 0 && age < 18) ? 'inline-block' : 'none';
}

function wireFamilyRemoveButtons(container) {
  container.querySelectorAll('.fm-remove').forEach((btn) => {
    btn.onclick = () => {
      const rows = container.querySelectorAll('.fm-row');
      if (rows.length > 1) {
        btn.closest('.fm-row-wrap').remove();
      } else {
        // Keep at least one (empty) row rather than leaving none — matches
        // the resting state initFamilyMembersEditor() starts with.
        const row = btn.closest('.fm-row');
        row.querySelector('.fm-name').value = '';
        row.querySelector('.fm-dob').value = '';
        row.querySelector('.fm-relation').selectedIndex = 0;
        updateMinorBadge(row);
      }
    };
  });
  container.querySelectorAll('.fm-dob').forEach((dobInput) => {
    dobInput.addEventListener('change', () => updateMinorBadge(dobInput.closest('.fm-row')));
    updateMinorBadge(dobInput.closest('.fm-row'));   // reflect any pre-filled DOB immediately
  });
}

/* Renders the existing family members (or one blank starter row) into
   `container` and wires the remove buttons. Call addFamilyMemberRow() from
   an "+ Add" button's click handler to append another row. */
export function initFamilyMembersEditor(container, existing = []) {
  const list = existing.length ? existing : [{}];
  container.innerHTML = list.map(familyMemberRowHTML).join('');
  wireFamilyRemoveButtons(container);
}

export function addFamilyMemberRow(container) {
  container.insertAdjacentHTML('beforeend', familyMemberRowHTML());
  wireFamilyRemoveButtons(container);
}

/* Reads the current rows back into a plain array, dropping any row left
   completely blank (so an unused row never gets saved as a "member" with no
   name). dob is stored as null rather than '' when left empty. */
export function collectFamilyMembers(container) {
  return [...container.querySelectorAll('.fm-row')]
    .map((row) => ({
      name: row.querySelector('.fm-name').value.trim(),
      relation: row.querySelector('.fm-relation').value,
      dob: row.querySelector('.fm-dob').value || null
    }))
    .filter((fm) => fm.name);
}

/* ---------------------------------------------------------------------- */
/*  Vehicle / parking editor                                              */
/*                                                                          */
/*  Both fields optional and neither blocks the other — a resident might   */
/*  have a vehicle with no allotted slot yet (visitor parking in the       */
/*  meantime), or a parking slot recorded before the vehicle itself is     */
/*  bought. Same repeatable-row pattern as Family Members and Pets.        */
/* ---------------------------------------------------------------------- */
function vehicleRowHTML(v = {}) {
  const esc = (s) => String(s == null ? '' : s).replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;');
  const sel = (want) => (v.vehicleType === want ? ' selected' : '');
  return `
    <div class="vehicle-row">
      <select class="veh-type">
        <option value="">Type</option>
        <option value="2-wheeler"${sel('2-wheeler')}>2-Wheeler</option>
        <option value="4-wheeler"${sel('4-wheeler')}>4-Wheeler</option>
      </select>
      <input type="text" class="veh-number" placeholder="Vehicle No. (e.g. RJ14AB1234)" maxlength="20" value="${esc(v.vehicleNumber)}" style="text-transform:uppercase;">
      <input type="text" class="veh-parking" placeholder="Parking Slot No." maxlength="20" value="${esc(v.parkingSlot)}">
      <input type="text" class="veh-rfid" placeholder="Boom Barrier RFID No." maxlength="30" value="${esc(v.rfidNumber)}">
      <button type="button" class="fm-remove" aria-label="Remove vehicle">✕</button>
    </div>`;
}

function wireVehicleRemoveButtons(container) {
  container.querySelectorAll('.fm-remove').forEach((btn) => {
    btn.onclick = () => {
      const rows = container.querySelectorAll('.vehicle-row');
      if (rows.length > 1) {
        btn.closest('.vehicle-row').remove();
      } else {
        const row = btn.closest('.vehicle-row');
        row.querySelector('.veh-type').value = '';
        row.querySelector('.veh-number').value = '';
        row.querySelector('.veh-parking').value = '';
        row.querySelector('.veh-rfid').value = '';
      }
    };
  });
}

export function initVehiclesEditor(container, existing = []) {
  const list = existing.length ? existing : [{}];
  container.innerHTML = list.map(vehicleRowHTML).join('');
  wireVehicleRemoveButtons(container);
}

export function addVehicleRow(container) {
  container.insertAdjacentHTML('beforeend', vehicleRowHTML());
  wireVehicleRemoveButtons(container);
}

/* Vehicle number is uppercased on save regardless of how it was typed —
   "rj14ab1234" and "RJ14AB1234" being treated as different vehicles by a
   future duplicate-check would be a real, silly bug. A row is only kept if
   it has a vehicle number; a parking slot with no vehicle recorded against
   it isn't a vehicle registration at all. vehicleType and rfidNumber are
   both optional — a resident filling this in from a phone at the gate
   often doesn't have the RFID tag number on hand, and blocking the whole
   vehicle entry on it would lose the vehicle number too. */
export function collectVehicles(container) {
  return [...container.querySelectorAll('.vehicle-row')]
    .map((row) => ({
      vehicleType: row.querySelector('.veh-type').value || null,
      vehicleNumber: row.querySelector('.veh-number').value.trim().toUpperCase(),
      parkingSlot: row.querySelector('.veh-parking').value.trim(),
      rfidNumber: row.querySelector('.veh-rfid').value.trim() || null
    }))
    .filter((v) => v.vehicleNumber);
}

/* ---------------------------------------------------------------------- */
/*  Pet registration editor                                               */
/*                                                                          */
/*  Only Name and Species are required — a resident registering a pet     */
/*  rarely has the vet's exact contact number or the microchip number     */
/*  memorised on the spot, and blocking the whole registration on that    */
/*  would just mean the pet never gets recorded at all. Everything else   */
/*  (vaccination dates especially) can be filled in later from "My Pets". */
/* ---------------------------------------------------------------------- */
function petCardHTML(pet = {}) {
  const sel = (v, want) => (v === want ? ' selected' : '');
  const chk = (v) => (v ? ' checked' : '');
  return `
  <div class="pet-card" data-photo-url="${escapeHtml(pet.photoURL || '')}">
    <div class="pet-card-header">
      <b>🐾 Pet</b>
      <button type="button" class="fm-remove pet-remove" aria-label="Remove this pet">✕</button>
    </div>
    <div class="field"><label>Pet Photo <span class="t-muted" style="font-weight:400;">(optional — helps security at the gate identify your pet)</span></label>
      <input type="file" class="pet-photo" accept="image/*">
      ${pet.photoURL ? `<div class="hint">A photo is already on file — choose a new one only if you want to replace it.</div>` : ''}
    </div>
    <div class="form-2col">
      <div class="field"><label>Pet Name</label><input class="pet-name" maxlength="80" value="${escapeHtml(pet.name || '')}"></div>
      <div class="field"><label>Species</label>
        <select class="pet-species">
          <option value="dog"${sel(pet.species, 'dog')}>Dog</option>
          <option value="cat"${sel(pet.species, 'cat')}>Cat</option>
          <option value="bird"${sel(pet.species, 'bird')}>Bird</option>
          <option value="other"${sel(pet.species, 'other')}>Other</option>
        </select>
      </div>
    </div>
    <div class="field pet-species-other-wrap" style="display:${pet.species === 'other' ? 'block' : 'none'};">
      <label>Species — please specify</label><input class="pet-species-other" maxlength="60" value="${escapeHtml(pet.speciesOther || '')}">
    </div>
    <div class="form-2col">
      <div class="field"><label>Breed <span class="t-muted" style="font-weight:400;">(optional)</span></label><input class="pet-breed" maxlength="80" value="${escapeHtml(pet.breed || '')}"></div>
      <div class="field"><label>Gender</label>
        <select class="pet-gender">
          <option value="male"${sel(pet.gender, 'male')}>Male</option>
          <option value="female"${sel(pet.gender, 'female')}>Female</option>
        </select>
      </div>
    </div>
    <div class="form-2col">
      <div class="field"><label>Age <span class="t-muted" style="font-weight:400;">(optional)</span></label><input class="pet-age" maxlength="30" placeholder="e.g. 2 years" value="${escapeHtml(pet.age || '')}"></div>
      <div class="field"><label>Colour / ID Marks <span class="t-muted" style="font-weight:400;">(optional)</span></label><input class="pet-colour" maxlength="150" value="${escapeHtml(pet.colourMarks || '')}"></div>
    </div>
    <div class="field"><label>Microchip No. <span class="t-muted" style="font-weight:400;">(if available)</span></label><input class="pet-microchip" maxlength="60" value="${escapeHtml(pet.microchipNo || '')}"></div>

    <div class="pet-section-label">Vaccination Details</div>
    <div class="form-2col">
      <div class="field"><label>Veterinary Doctor <span class="t-muted" style="font-weight:400;">(optional)</span></label><input class="pet-vet-name" maxlength="100" value="${escapeHtml(pet.vetDoctorName || '')}"></div>
      <div class="field"><label>Clinic / Hospital <span class="t-muted" style="font-weight:400;">(optional)</span></label><input class="pet-clinic-name" maxlength="100" value="${escapeHtml(pet.clinicName || '')}"></div>
    </div>
    <div class="form-2col">
      <div class="field"><label>Vet Contact Number <span class="t-muted" style="font-weight:400;">(optional)</span></label><input class="pet-vet-contact" type="tel" maxlength="15" value="${escapeHtml(pet.vetContactNumber || '')}"></div>
      <div class="field"><label>Last Vaccination Date</label><input class="pet-last-vax" type="date" value="${escapeHtml(pet.lastVaccinationDate || '')}"></div>
    </div>
    <div class="field">
      <label>Next Vaccination Due Date</label><input class="pet-next-vax" type="date" value="${escapeHtml(pet.nextVaccinationDue || '')}">
      <div class="hint">You'll get a reminder around this date to re-vaccinate.</div>
    </div>
    <div class="pet-cert-checks">
      <label class="checkbox-row"><input type="checkbox" class="pet-cert-rabies"${chk(pet.hasAntiRabiesCert)}> I have the Anti-Rabies Vaccination Certificate</label>
      <label class="checkbox-row"><input type="checkbox" class="pet-cert-annual"${chk(pet.hasAnnualVaccinationRecord)}> I have the Annual Vaccination Record</label>
      <label class="checkbox-row"><input type="checkbox" class="pet-cert-health"${chk(pet.hasVetHealthCert)}> I have the Veterinary Health Certificate</label>
      <label class="checkbox-row"><input type="checkbox" class="pet-cert-sterilization"${chk(pet.hasSterilizationCert)}> I have the Sterilization Certificate (if applicable)</label>
    </div>
    <div class="field"><label>Sterilization Status <span class="t-muted" style="font-weight:400;">(optional)</span></label>
      <select class="pet-sterilization-status">
        <option value="">Select</option>
        <option value="yes"${sel(pet.sterilizationStatus, 'yes')}>Yes, sterilized</option>
        <option value="no"${sel(pet.sterilizationStatus, 'no')}>No</option>
        <option value="not_applicable"${sel(pet.sterilizationStatus, 'not_applicable')}>Not applicable</option>
        <option value="unknown"${sel(pet.sterilizationStatus, 'unknown')}>Unknown</option>
      </select>
    </div>

    <div class="pet-section-label">Emergency Contact (for this pet)</div>
    <div class="form-2col">
      <div class="field"><label>Contact Person <span class="t-muted" style="font-weight:400;">(optional)</span></label><input class="pet-emg-name" maxlength="100" value="${escapeHtml(pet.emergencyContactName || '')}"></div>
      <div class="field"><label>Relationship <span class="t-muted" style="font-weight:400;">(optional)</span></label><input class="pet-emg-relation" maxlength="60" value="${escapeHtml(pet.emergencyContactRelation || '')}"></div>
    </div>
    <div class="field"><label>Mobile Number <span class="t-muted" style="font-weight:400;">(optional)</span></label><input class="pet-emg-mobile" type="tel" maxlength="15" value="${escapeHtml(pet.emergencyContactMobile || '')}"></div>
  </div>`;
}

function wirePetCard(card) {
  const speciesSel = card.querySelector('.pet-species');
  const otherWrap = card.querySelector('.pet-species-other-wrap');
  speciesSel.addEventListener('change', () => {
    otherWrap.style.display = speciesSel.value === 'other' ? 'block' : 'none';
  });
  card.querySelector('.pet-remove').addEventListener('click', () => card.remove());
}

/* Renders existing pets (or nothing, if the resident has none yet) into
   `container` and wires each card's species-toggle + remove button. */
export function initPetsEditor(container, existing = []) {
  container.innerHTML = existing.map(petCardHTML).join('');
  container.querySelectorAll('.pet-card').forEach(wirePetCard);
}

export function addPetCard(container) {
  container.insertAdjacentHTML('beforeend', petCardHTML());
  wirePetCard(container.lastElementChild);
}

/* Reads every pet card back into an array of plain objects, dropping any
   card left completely nameless (an accidentally-added empty card should
   not become a pet with no name in the database). */
export function collectPets(container) {
  return [...container.querySelectorAll('.pet-card')]
    .map((card) => ({
      name: card.querySelector('.pet-name').value.trim(),
      species: card.querySelector('.pet-species').value,
      speciesOther: card.querySelector('.pet-species-other').value.trim(),
      breed: card.querySelector('.pet-breed').value.trim(),
      gender: card.querySelector('.pet-gender').value,
      age: card.querySelector('.pet-age').value.trim(),
      colourMarks: card.querySelector('.pet-colour').value.trim(),
      microchipNo: card.querySelector('.pet-microchip').value.trim(),
      vetDoctorName: card.querySelector('.pet-vet-name').value.trim(),
      clinicName: card.querySelector('.pet-clinic-name').value.trim(),
      vetContactNumber: card.querySelector('.pet-vet-contact').value.trim(),
      lastVaccinationDate: card.querySelector('.pet-last-vax').value || null,
      nextVaccinationDue: card.querySelector('.pet-next-vax').value || null,
      hasAntiRabiesCert: card.querySelector('.pet-cert-rabies').checked,
      hasAnnualVaccinationRecord: card.querySelector('.pet-cert-annual').checked,
      hasVetHealthCert: card.querySelector('.pet-cert-health').checked,
      hasSterilizationCert: card.querySelector('.pet-cert-sterilization').checked,
      sterilizationStatus: card.querySelector('.pet-sterilization-status').value || null,
      emergencyContactName: card.querySelector('.pet-emg-name').value.trim(),
      emergencyContactRelation: card.querySelector('.pet-emg-relation').value.trim(),
      emergencyContactMobile: card.querySelector('.pet-emg-mobile').value.trim(),
      // Not a serializable Firestore value — the caller uploads this (if
      // present) and replaces it with a photoURL string before writing.
      // Kept inside the same filter step as everything else so an
      // accidentally-added empty card's photo never gets uploaded either.
      photoFile: card.querySelector('.pet-photo').files[0] || null,
      photoURL: card.dataset.photoUrl || null
    }))
    .filter((p) => p.name);
}

/* Vaccination-due status for one pet, relative to today: overdue (past the
   due date), due soon (within the next 30 days), or fine. Mirrors the shape
   duesFor()/pollStatus() use elsewhere — a status string plus whatever the
   caller needs to display. Pets with no nextVaccinationDue set simply have
   nothing to report; that is not the same as being overdue. */
/* Deliberately narrow: only counts things that apply to every resident
   regardless of circumstance (a photo, a birthdate) plus one "personal
   details" slot that's satisfied by EITHER an anniversary or a listed
   family member — an unmarried resident with no family living with them
   isn't "less complete" than someone who happens to have both. Nominee and
   address were both removed from the data model entirely, so neither
   factors in here; there's nothing to be incomplete about that isn't
   asked for anymore. */
export function profileCompleteness(member) {
  const items = [
    { key: 'photo', label: 'Add a photo', done: !!member?.photoURL },
    { key: 'dob', label: 'Add your date of birth', done: !!member?.dob },
    {
      key: 'personal',
      label: 'Add your anniversary or a family member',
      done: !!member?.anniversary || (Array.isArray(member?.familyMembers) && member.familyMembers.length > 0)
    }
  ];
  const done = items.filter(i => i.done).length;
  return { pct: Math.round((done / items.length) * 100), missing: items.filter(i => !i.done) };
}

export function petVaccinationStatus(pet) {
  if (!pet.nextVaccinationDue) return { status: 'unknown', daysUntil: null };
  const due = new Date(pet.nextVaccinationDue);
  if (Number.isNaN(due.getTime())) return { status: 'unknown', daysUntil: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((due - today) / 86400000);
  if (daysUntil < 0) return { status: 'overdue', daysUntil };
  if (daysUntil <= 30) return { status: 'due_soon', daysUntil };
  return { status: 'fine', daysUntil };
}

/* Same shape as petVaccinationStatus — a tenant's rentAgreementEnd date sat
   uncollected-but-unused since the field was added; this is what actually
   turns it into a reminder rather than a fact nobody looks at again. */
export function rentAgreementStatus(member) {
  if (!member?.rentAgreementEnd) return { status: 'unknown', daysUntil: null };
  const due = new Date(member.rentAgreementEnd);
  if (Number.isNaN(due.getTime())) return { status: 'unknown', daysUntil: null };
  const today = new Date(); today.setHours(0, 0, 0, 0);
  due.setHours(0, 0, 0, 0);
  const daysUntil = Math.round((due - today) / 86400000);
  if (daysUntil < 0) return { status: 'expired', daysUntil };
  if (daysUntil <= 30) return { status: 'expiring_soon', daysUntil };
  return { status: 'valid', daysUntil };
}

/* ---------------------------------------------------------------------- */
/*  Birthday / anniversary reminders                                        */
/*                                                                          */
/*  Matches month+day only (the year is irrelevant for a recurring          */
/*  birthday). Scans each approved member's own DOB/anniversary plus every   */
/*  family member's DOB, so "today" can include people who don't have their  */
/*  own login — the wish still goes out via the resident's WhatsApp number.  */
/* ---------------------------------------------------------------------- */
export function todaysCelebrations(members, today = new Date()) {
  const mm = String(today.getMonth() + 1).padStart(2, '0');
  const dd = String(today.getDate()).padStart(2, '0');
  const isToday = (dateStr) => typeof dateStr === 'string' && dateStr.length >= 10 && dateStr.slice(5, 7) === mm && dateStr.slice(8, 10) === dd;

  const out = [];
  (members || []).filter((m) => m.status === 'approved').forEach((m) => {
    const flat = `${m.tower || ''}-${m.flatNumber || ''}`;
    if (isToday(m.dob)) out.push({ kind: 'birthday', name: m.name, relation: null, mobile: m.mobile, memberName: m.name, flat, memberId: m.id });
    if (isToday(m.anniversary)) out.push({ kind: 'anniversary', name: m.name, relation: null, mobile: m.mobile, memberName: m.name, flat, memberId: m.id });
    (m.familyMembers || []).forEach((fm) => {
      if (isToday(fm.dob)) out.push({ kind: 'birthday', name: fm.name, relation: fm.relation || null, mobile: m.mobile, memberName: m.name, flat, memberId: m.id });
    });
  });
  return out;
}

/* Same idea as todaysCelebrations(), but for the next N days (today itself
   excluded — that's what todaysCelebrations() is for). Walks forward day by
   day using real Date arithmetic so a Dec 29 birthday correctly shows up as
   "in 3 days" when today is Dec 26, even across a year boundary. Results are
   sorted soonest-first so the committee sees what's coming up next. */
export function upcomingCelebrations(members, days = 7, today = new Date()) {
  const targets = [];
  for (let i = 1; i <= days; i++) {
    const d = new Date(today);
    d.setDate(d.getDate() + i);
    targets.push({ mm: String(d.getMonth() + 1).padStart(2, '0'), dd: String(d.getDate()).padStart(2, '0'), daysAway: i });
  }
  const matchDay = (dateStr) => {
    if (typeof dateStr !== 'string' || dateStr.length < 10) return null;
    const mm = dateStr.slice(5, 7), dd = dateStr.slice(8, 10);
    const t = targets.find((x) => x.mm === mm && x.dd === dd);
    return t ? t.daysAway : null;
  };

  const out = [];
  (members || []).filter((m) => m.status === 'approved').forEach((m) => {
    const flat = `${m.tower || ''}-${m.flatNumber || ''}`;
    let d = matchDay(m.dob);
    if (d != null) out.push({ kind: 'birthday', name: m.name, relation: null, mobile: m.mobile, memberName: m.name, flat, memberId: m.id, daysAway: d });
    d = matchDay(m.anniversary);
    if (d != null) out.push({ kind: 'anniversary', name: m.name, relation: null, mobile: m.mobile, memberName: m.name, flat, memberId: m.id, daysAway: d });
    (m.familyMembers || []).forEach((fm) => {
      const fd = matchDay(fm.dob);
      if (fd != null) out.push({ kind: 'birthday', name: fm.name, relation: fm.relation || null, mobile: m.mobile, memberName: m.name, flat, memberId: m.id, daysAway: fd });
    });
  });
  out.sort((a, b) => a.daysAway - b.daysAway);
  return out;
}

/* A warm, ready-to-send wish. The message is addressed to whichever person
   is celebrating; when it's a family member without their own number, the
   wish still goes to the resident's WhatsApp with their relative named, so
   it reads naturally either way. */
export function celebrationWishMessage(entry, societyName) {
  if (entry.kind === 'anniversary') {
    return `🎉 ${societyName} ki taraf se ${entry.name} ji ko Wedding Anniversary ki dher saari shubhkamnayein! Aapka vaivahik jeevan khushiyon se bhara rahe. 🎊`;
  }
  const who = entry.relation ? `${entry.relation} ${entry.name} ji` : `${entry.name} ji`;
  return `🎂 ${societyName} ki taraf se ${who} ko Janamdin ki dher saari shubhkamnayein! Aapki zindagi khushiyon aur sehat se bhari rahe. 🎈`;
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
