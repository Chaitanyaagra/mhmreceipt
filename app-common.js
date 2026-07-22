/* ==========================================================================
   MHMRWS Portal — shared application logic
   Imported by index.html, admin.html and verify.html.
   Requires (loaded as classic <script> tags before this module runs):
     jsPDF, qrcode.js, SheetJS (XLSX), JSZip  — see each HTML file's <head>
   ========================================================================== */

import { db } from './firebase-config.js';
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
  return parts.join(' ') + ' Rupees Only';
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
    try { pdf.addImage(logoDataUrl, 'PNG', marginX, 24, 52, 52); } catch (e) {/* skip logo if it fails to decode */}
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
