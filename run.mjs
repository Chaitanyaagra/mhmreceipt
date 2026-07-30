/* MHMRWS Portal — test suite.  Run with:  node tests/run.mjs   (or: npm test)

   Covers the parts where a bug means wrong money or a broken record: the dues
   maths, the maintenance invoice figures, receipt/member token format, INR
   formatting, payment validation, the pager windowing, and HTML escaping.
   No browser, no network, no installed packages. */
import { loadAppCommon } from './_load-app-common.mjs';
import { eq, ok, near, section, report } from './_harness.mjs';

// Minimal DOM shim so the couple of functions that touch `document`/`crypto`
// at module scope don't throw on import.
globalThis.document = globalThis.document || undefined;
if (!globalThis.crypto) globalThis.crypto = (await import('node:crypto')).webcrypto;

const A = await loadAppCommon();

/* ---- Maintenance dues / invoice ---------------------------------------- */
section('Maintenance dues & invoice');
const settings = { rates: { '2025-26': { default: 2400, byTower: { A: 2000 } } } };
const memA = { uid: 'u1', tower: 'A', flatNumber: 'A-101' };
const memB = { uid: 'u2', tower: 'B', flatNumber: 'B-202' };

eq(A.expectedDue(memA, '2025-26', settings), 2000, 'per-tower rate overrides default (Tower A = 2000)');
eq(A.expectedDue(memB, '2025-26', settings), 2400, 'tower without an override falls back to default');
eq(A.expectedDue(memA, '2099-99', settings), 0, 'no rate for the year = nothing owed');
eq(A.expectedDue(memA, '2025-26', {}), 0, 'no settings at all = nothing owed');

const pays = [
  { memberUid: 'u1', status: 'verified', financialYear: '2025-26', amount: 600 },
  { memberUid: 'u1', status: 'verified', financialYear: '2025-26', amount: 400 },
  { memberUid: 'u1', status: 'pending_verification', financialYear: '2025-26', amount: 999 }, // must be ignored
  { memberUid: 'u1', status: 'verified', financialYear: '2024-25', amount: 500 },             // wrong year, ignored
  { memberUid: 'u2', status: 'verified', financialYear: '2025-26', amount: 100 },             // other member, ignored
];
eq(A.paidSoFar(pays, 'u1', '2025-26'), 1000, 'only verified, same-year, same-member payments count');

const dues = A.duesFor(memA, pays, '2025-26', settings);
eq(dues.expected, 2000, 'invoice: expected');
eq(dues.paid, 1000, 'invoice: paid');
eq(dues.outstanding, 1000, 'invoice: outstanding = expected − paid');
eq(dues.status, 'partial', 'invoice: partial when 0 < paid < expected');

eq(A.duesFor(memA, [], '2025-26', settings).status, 'unpaid', 'status unpaid when nothing paid');
eq(A.duesFor(memA, [{ memberUid: 'u1', status: 'verified', financialYear: '2025-26', amount: 2000 }], '2025-26', settings).status, 'paid', 'status paid when exactly cleared');
eq(A.duesFor(memA, [{ memberUid: 'u1', status: 'verified', financialYear: '2025-26', amount: 5000 }], '2025-26', settings).status, 'overpaid', 'status overpaid beyond expected');
eq(A.duesFor(memA, pays, '2099-99', settings).status, 'no_rate', 'status no_rate when the year has no rate');
// Outstanding must never go negative (drives the ring + invoice).
ok(A.duesFor(memA, [{ memberUid: 'u1', status: 'verified', financialYear: '2025-26', amount: 9999 }], '2025-26', settings).outstanding === 0, 'overpaid outstanding clamps to 0');

/* ---- Public verification tokens ---------------------------------------- */
section('Public tokens');
const tok = A.newPublicToken();
ok(/^[0-9a-f]{32}$/.test(tok), 'token is 32 lowercase hex chars (matches firestore.rules isPublicToken)');
const many = new Set(Array.from({ length: 4000 }, () => A.newPublicToken()));
eq(many.size, 4000, 'no collisions across 4000 tokens');
ok(A.publicKeyForReceipt({ publicToken: tok, receiptNumber: 'R-1' }) === tok, 'receipt key prefers the token');
ok(A.publicKeyForReceipt({ receiptNumber: 'R-1' }) === 'R-1', 'receipt key falls back to the number (legacy)');
ok(A.publicKeyForMember({ memberID: 'M-1' }) === 'M-1', 'member key falls back to the member ID');

/* ---- INR formatting ----------------------------------------------------- */
section('INR formatting');
ok(A.formatINR(2400).includes('2,400'), 'thousands separator');
ok(A.formatINR(0).includes('0'), 'zero renders');
ok(typeof A.formatINR(null) === 'string', 'null does not throw');

/* ---- Payment validation ------------------------------------------------- */
section('Payment validation');
ok(A.validatePayment({ amount: 2000, mode: 'upi', utr: 'ABC123', isOffline: false }) == null, 'valid online payment passes');
ok(A.validatePayment({ amount: 0, mode: 'upi', utr: 'X', isOffline: false }) != null, 'zero amount rejected');
ok(A.validatePayment({ amount: -5, mode: 'cash', utr: '', isOffline: true }) != null, 'negative amount rejected');
ok(A.validatePayment({ amount: 2000, mode: 'upi', utr: '', isOffline: false }) != null, 'online payment needs a UTR');
ok(A.validatePayment({ amount: 2000, mode: 'cash', utr: '', isOffline: true }) == null, 'offline (cash) payment needs no UTR');

/* ---- HTML escaping ------------------------------------------------------ */
section('HTML escaping');
eq(A.escapeHtml('<b>&"\'</b>'), '&lt;b&gt;&amp;&quot;&#39;&lt;/b&gt;', 'all five special chars escaped');
eq(A.escapeHtml('राज कुमार'), 'राज कुमार', 'Devanagari passes through untouched');
eq(A.escapeHtml(0), '0', 'number 0 renders, not blank');
eq(A.escapeHtml(null), '', 'null becomes empty string');

/* ---- Pager windowing ---------------------------------------------------- */
section('Pager windowing');
function pagerSeq(page, pages, pageSize = 10) {
  let html = '';
  const container = { set innerHTML(v) { html = v; }, get innerHTML() { return html; }, querySelectorAll: () => [] };
  A.renderPager(container, { page, pageSize, total: pages * pageSize, onPage() {} });
  return [...html.matchAll(/<button class="pager-btn[^"]*"[^>]*>([^<]+)<\/button>|<span class="pager-gap">…<\/span>/g)]
    .map(x => x[1] ? x[1] : '…').filter(x => x !== '‹' && x !== '›').join(' ');
}
{
  let html = '';
  const c = { set innerHTML(v) { html = v; }, get innerHTML() { return html; }, querySelectorAll: () => [] };
  A.renderPager(c, { page: 1, pageSize: 10, total: 8, onPage() {} });
  eq(html, '', 'single page renders no pager');
}
eq(pagerSeq(1, 12), '1 2 … 12', 'first page');
eq(pagerSeq(6, 12), '1 … 5 6 7 … 12', 'middle page has both ellipses');
eq(pagerSeq(12, 12), '1 … 11 12', 'last page');

/* ---- tsMillis ----------------------------------------------------------- */
section('Timestamp helper');
eq(A.tsMillis(null), 0, 'null → 0');
ok(A.tsMillis({ toDate: () => new Date(1000) }) === 1000, 'Firestore Timestamp handled');
ok(A.tsMillis('2025-01-01') > 0, 'ISO string handled');

/* ---- Registration validation (shape + fields) --------------------------- */
section('Registration validation');
function makeForm(over = {}) {
  const base = {
    name: 'Ramesh Kumar', fatherHusbandName: 'Suresh Kumar',
    tower: 'A', flatNumber: 'A-101', mobile: '9876543210',
    email: 'r@example.com', occupation: 'Engineer', residentType: 'owner',
    address: 'Flat A-101, Tower A', nomineeName: 'Sita Devi', nomineeRelation: 'Wife',
    password: 'secret123', confirmPassword: 'secret123',
  };
  const merged = { ...base, ...over };
  const f = {};
  for (const [k, v] of Object.entries(merged)) if (!k.startsWith('__')) f[k] = { value: v };
  f.photo = { files: over.__noPhoto ? [] : [{ name: 'p.jpg' }] };
  f.declaration = { checked: over.__noDeclaration ? false : true };
  f.elements = f;
  return f;
}
const towers = Object.keys(A.TOWER_PLAN || {});
ok(towers.length > 0, 'TOWER_PLAN has at least one tower');
const t0 = towers[0];
// flatsForTower returns floor-groups {floor,label,flats:[...]}; grab a real flat.
const groups = A.flatsForTower ? A.flatsForTower(t0) : [];
const firstFlat = (groups.find(g => g.flats && g.flats.length) || { flats: ['101'] }).flats[0];
ok(A.isValidFlat(t0, firstFlat), 'derived a genuinely valid flat for the happy path');
eq(A.validateRegistration(makeForm({ tower: t0, flatNumber: firstFlat })), null, 'a fully valid form passes (returns null)');

// EVERY error return must be a {field, message} object — the exact bug class
// that broke the long-name and invalid-flat returns.
const badForms = [
  makeForm({ tower: t0, flatNumber: firstFlat, name: '' }),
  makeForm({ tower: t0, flatNumber: firstFlat, name: 'x'.repeat(200) }),   // regression guard: long name
  makeForm({ tower: t0, flatNumber: 'Z-999' }),                            // regression guard: bad flat
  makeForm({ tower: t0, flatNumber: firstFlat, mobile: '12345' }),
  makeForm({ tower: t0, flatNumber: firstFlat, mobile: '5876543210' }),
  makeForm({ tower: t0, flatNumber: firstFlat, email: 'notanemail' }),
  makeForm({ tower: t0, flatNumber: firstFlat, residentType: 'landlord' }),
  makeForm({ tower: t0, flatNumber: firstFlat, password: '123' }),
  makeForm({ tower: t0, flatNumber: firstFlat, confirmPassword: 'different' }),
  makeForm({ tower: t0, flatNumber: firstFlat, __noPhoto: true }),
  makeForm({ tower: t0, flatNumber: firstFlat, __noDeclaration: true }),
];
let allShaped = true, fieldsValid = true;
const validFields = new Set(['name','fatherHusbandName','tower','flatNumber','mobile','email',
  'occupation','residentType','address','nomineeName','nomineeRelation','photo','password','confirmPassword','declaration']);
for (const bf of badForms) {
  const r = A.validateRegistration(bf);
  if (!r || typeof r !== 'object' || typeof r.field !== 'string' || typeof r.message !== 'string') allShaped = false;
  else if (!validFields.has(r.field)) { fieldsValid = false; console.log('    unexpected field:', r.field); }
}
ok(allShaped, 'every validation error is a {field,message} object (guards the 2 fixed returns)');
ok(fieldsValid, 'every error.field names a real form field');

/* ---- currentFinancialYear ---------------------------------------------- */
section('Financial year');
ok(/^\d{4}-\d{2}$/.test(A.currentFinancialYear()), 'FY has the shape YYYY-YY');

/* ---- Edge cases: malformed data must never yield NaN or wrong money ----- */
section('Edge cases (money safety)');
{
  const s2 = { rates: { '2025-26': { default: 2400 } } };
  // Floating-point payments must sum without loss.
  ok(A.paidSoFar([
    { memberUid: 'u', status: 'verified', financialYear: '2025-26', amount: 0.1 },
    { memberUid: 'u', status: 'verified', financialYear: '2025-26', amount: 0.2 },
  ], 'u', '2025-26') > 0.29, 'float amounts sum without loss');
  // null / missing / non-numeric amounts count as 0, never NaN.
  const paid = A.paidSoFar([
    { memberUid: 'u', status: 'verified', financialYear: '2025-26', amount: null },
    { memberUid: 'u', status: 'verified', financialYear: '2025-26' },
    { memberUid: 'u', status: 'verified', financialYear: '2025-26', amount: 'abc' },
  ], 'u', '2025-26');
  ok(Number.isFinite(paid) && paid === 0, 'malformed amounts count as 0, not NaN');
  // duesFor tolerates null payments and never throws.
  const d = A.duesFor({ uid: 'u', tower: 'X', flatNumber: '1' }, null, '2025-26', s2);
  ok(d.expected === 2400 && d.paid === 0 && d.outstanding === 2400, 'duesFor handles null payments');
  // formatINR survives hostile inputs.
  ok(typeof A.formatINR(2400.5) === 'string', 'formatINR handles a float');
  ok(typeof A.formatINR(-500) === 'string', 'formatINR handles a negative');
  ok(typeof A.formatINR(Infinity) === 'string', 'formatINR handles Infinity without throwing');
  // Amount precision + bounds in validation.
  ok(A.validatePayment({ amount: 100.999, mode: 'cash', utr: '', isOffline: true }) !== null, 'more than 2 decimals rejected');
  ok(A.validatePayment({ amount: 99999999, mode: 'upi', utr: 'X1', isOffline: false }) !== null, 'absurdly large amount rejected');
}

/* ---- One-time membership fee -------------------------------------------- */
section('Membership fee');
{
  const m = { uid: 'u1', tower: 'A', flatNumber: 'A-101' };
  // Default fee is ₹1100 when nothing configured.
  eq(A.membershipFeeAmount({}), 1100, 'membership fee defaults to ₹1100');
  eq(A.membershipFeeAmount({ membershipFee: 500 }), 500, 'configured membership fee overrides default');
  eq(A.membershipFeeAmount(null), 1100, 'null settings → default fee');

  // Only verified membership-type payments count.
  const pays = [
    { memberUid: 'u1', status: 'verified', type: 'membership', amount: 1100 },
    { memberUid: 'u1', status: 'verified', type: 'maintenance', amount: 2400 }, // not membership
    { memberUid: 'u1', status: 'pending_verification', type: 'membership', amount: 999 }, // not verified
    { memberUid: 'u2', status: 'verified', type: 'membership', amount: 1100 }, // other member
  ];
  eq(A.membershipPaid(pays, 'u1'), 1100, 'only verified membership payments by this member count');

  const cleared = A.membershipDue(m, pays, {});
  eq(cleared.fee, 1100, 'membershipDue: fee');
  eq(cleared.paid, 1100, 'membershipDue: paid');
  eq(cleared.outstanding, 0, 'membershipDue: outstanding 0 when fully paid');
  ok(cleared.cleared === true, 'membershipDue: cleared flag true');

  const unpaid = A.membershipDue(m, [], {});
  eq(unpaid.outstanding, 1100, 'new member owes the full ₹1100');
  ok(unpaid.cleared === false, 'membershipDue: cleared flag false when unpaid');

  // Partial membership payment.
  const partial = A.membershipDue(m, [{ memberUid: 'u1', status: 'verified', type: 'membership', amount: 600 }], {});
  eq(partial.outstanding, 500, 'partial membership payment leaves the remainder');

  // Backward-compat: old payments with no type must NOT count as membership.
  const legacy = A.membershipDue(m, [{ memberUid: 'u1', status: 'verified', amount: 1100 }], {});
  eq(legacy.outstanding, 1100, 'untyped legacy payments do not clear membership');
}

/* ---- Payment details defaults ------------------------------------------ */
section('Payment details defaults');
{
  const d = A.paymentDetails({});
  eq(d.bankName, 'HDFC Bank', 'default bank name present');
  eq(d.ifsc, 'HDFC0003774', 'default IFSC present');
  eq(d.accountNumber, '50200123261579', 'default account number present');
  ok(d.officeAddress.includes('Suncity'), 'default office address present');
  // Saved values override defaults; unset fields fall back.
  const merged = A.paymentDetails({ upiId: 'mhm@upi', bankName: 'SBI' });
  eq(merged.upiId, 'mhm@upi', 'saved UPI overrides');
  eq(merged.bankName, 'SBI', 'saved bank overrides');
  eq(merged.ifsc, 'HDFC0003774', 'unset field falls back to default');
  // null/undefined saved settings must not throw.
  ok(A.paymentDetails(null).bankName === 'HDFC Bank', 'null saved settings → defaults');
}

report();
