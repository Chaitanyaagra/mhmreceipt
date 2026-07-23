/* ==========================================================================
   MHMRWS Portal — shared application logic
   Imported by index.html, admin.html and verify.html.
   Requires (loaded as classic <script> tags before this module runs):
     jsPDF, qrcode.js, SheetJS (XLSX), JSZip  — see each HTML file's <head>
   ========================================================================== */

import { db } from './firebase-config.js';
import { TOWER_PLAN, isValidFlat } from './tower-plan.js';
import {
  doc, getDoc, setDoc, addDoc, collection, runTransaction, serverTimestamp
} from "https://www.gstatic.com/firebasejs/12.16.0/firebase-firestore.js";

/* ---------------------------------------------------------------------- */
/*  Toasts                                                                 */
/* ---------------------------------------------------------------------- */
export function showToast(message, type = 'info') {
  let region = document.getElementById('toast-region');
  if (!region) {
    region = document.createElement('div');
    region.id = 'toast-region';
    document.body.appendChild(region);
  }
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.setAttribute('role', 'status');
  el.textContent = message;
  region.appendChild(el);
  setTimeout(() => {
    el.style.transition = 'opacity .3s ease';
    el.style.opacity = '0';
    setTimeout(() => el.remove(), 300);
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

  if (!name) return 'Naam zaroori hai.';
  if (name.length > LIMITS.nameMax) return `Naam ${LIMITS.nameMax} characters se lamba nahi ho sakta.`;
  // \p{M} matters here: Devanagari matras (ा ि ो) are Unicode *Marks*, not
  // Letters, so without it every Hindi name would be rejected.
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(name)) return 'Naam mein sirf akshar, space, aur . \' - ho sakte hain.';

  if (!father) return 'Pita / Pati ka naam zaroori hai.';
  if (father.length > LIMITS.nameMax) return 'Pita / Pati ka naam bahut lamba hai.';
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(father)) return 'Pita / Pati ke naam mein sirf akshar aur space ho sakte hain.';

  if (!tower) return 'Tower chunna zaroori hai.';
  if (!TOWER_PLAN[tower]) return 'Tower valid nahi hai.';
  if (!flat) return 'Flat number chunna zaroori hai.';
  if (!isValidFlat(tower, flat)) return `Flat ${flat} Tower ${tower} mein maujood nahi hai.`;

  // Indian mobile numbers begin 6, 7, 8 or 9 — this rejects landlines and
  // the common habit of typing a 0 or +91 prefix into the field.
  if (!/^[0-9]{10}$/.test(mobile)) return 'Mobile number theek 10 ankon ka hona chahiye (bina 0 ya +91 ke).';
  if (!/^[6-9]/.test(mobile)) return 'Mobile number 6, 7, 8 ya 9 se shuru hona chahiye.';

  if (!email) return 'Email zaroori hai.';
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return 'Email address sahi format mein nahi hai.';

  if (!occupation) return 'Occupation zaroori hai.';
  if (occupation.length > 100) return 'Occupation bahut lamba hai.';
  if (!residentType) return 'Owner ya Tenant chunna zaroori hai.';
  if (!['owner', 'tenant'].includes(residentType)) return 'Owner / Tenant valid nahi hai.';

  if (!address) return 'Address zaroori hai.';
  if (address.length > LIMITS.addressMax) return 'Address bahut lamba hai.';

  if (!nomineeName) return 'Nominee ka naam zaroori hai.';
  if (!/^[\p{L}\p{M}\s.'-]+$/u.test(nomineeName)) return 'Nominee ke naam mein sirf akshar aur space ho sakte hain.';
  if (!nomineeRelation) return 'Nominee se sambandh zaroori hai.';

  if (!f.photo?.files?.length) return 'Apni photo upload karna zaroori hai.';
  // Aadhaar / PAN is deliberately NOT required — see the note in index.html.

  if (f.password.value.length < 6) return 'Password kam se kam 6 characters ka hona chahiye.';
  if (f.password.value !== f.confirmPassword.value) return 'Password match nahi kar raha.';
  if (!f.declaration.checked) return 'Aage badhne ke liye declaration par tick karein.';
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

export function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = String(str ?? '');
  return div.innerHTML;
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
/*  Audit log — immutable ledger of admin actions (userId + IP + action)   */
/* ---------------------------------------------------------------------- */
let cachedIP = null;
export async function getClientIP() {
  if (cachedIP) return cachedIP;
  try {
    const res = await fetch('https://api.ipify.org?format=json');
    const data = await res.json();
    cachedIP = data.ip;
    return cachedIP;
  } catch (e) {
    return 'unavailable';
  }
}

export async function logAudit(user, action, details = {}) {
  try {
    const ip = await getClientIP();
    await addDoc(collection(db, 'auditLogs'), {
      userId: user?.uid || 'system',
      userEmail: user?.email || 'system',
      action,
      details,
      ip,
      timestamp: serverTimestamp()
    });
  } catch (e) {
    console.warn('Audit log write failed:', e);
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

export function verifyUrlFor(receiptNumber) {
  const base = window.location.origin + window.location.pathname.replace(/[^/]+$/, '');
  return `${base}verify.html?receipt=${encodeURIComponent(receiptNumber)}`;
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
    const qrUrl = verifyUrlFor(payment.receiptNumber);
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
  pdf.text(`Verify anytime at: ${verifyUrlFor(payment.receiptNumber)}`, marginX, y + 13);

  if (save) {
    pdf.save(`Receipt-${payment.receiptNumber}.pdf`);
    return null;
  }
  return pdf.output('blob');
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
  try { qrImg = await generateQR(verifyUrlFor(payment.receiptNumber), 200); } catch (e) {/* print still works without the QR */}

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
        Verify anytime at: ${escapeHtml(verifyUrlFor(payment.receiptNumber))}
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

export function memberVerifyUrl(memberID) {
  const base = window.location.origin + window.location.pathname.replace(/[^/]+$/, '');
  return `${base}verify.html?member=${encodeURIComponent(memberID)}`;
}

function loadImage(src) {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
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
  return c.toDataURL('image/jpeg', 0.92);
}

export async function generateMembershipCard({ member, society, logoDataUrl, financialYear }) {
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
  const sealImg = await sealOnWhiteDisc(logoDataUrl);
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
  if (member.photoDataUrl) {
    try { pdf.addImage(member.photoDataUrl, 'JPEG', photoX + 0.4, photoY + 0.4, photoW - 0.8, photoH - 0.8); }
    catch (e) {}
  }

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
    const qr = await generateQR(memberVerifyUrl(member.memberID), 320);
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
  if (society.regNumber) pdf.text(`RERA ${society.regNumber}`, CARD_W - M, CARD_H - 5.4, { align: 'right' });
  pdf.text('Grand Sikar Road, Jaipur', CARD_W - M, CARD_H - 2.6, { align: 'right' });

  pdf.save(`MHMRWS-Card-${member.memberID || 'member'}.pdf`);
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

/* ---------------------------------------------------------------------- */
/*  Bulk ZIP export (uses JSZip — window.JSZip)                           */
/* ---------------------------------------------------------------------- */
export async function zipFilesFromUrls(fileList, zipFilename) {
  const zip = new window.JSZip();
  for (const f of fileList) {
    try {
      const res = await fetch(f.url);
      const blob = await res.blob();
      zip.file(f.name, blob);
    } catch (e) { console.warn('Skipped file in zip (fetch failed):', f.name, e); }
  }
  const blob = await zip.generateAsync({ type: 'blob' });
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = zipFilename;
  a.click();
  URL.revokeObjectURL(a.href);
}
