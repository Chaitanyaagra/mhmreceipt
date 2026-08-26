#!/usr/bin/env node
/* ==========================================================================
   MHMRWS Portal — test suite entry point.
   Run with: npm test  (or:  node tests/run.mjs)

   Why this exists: app-common.js is browser-facing — it imports the
   Firestore SDK from https://www.gstatic.com/... and firebase-config.js,
   neither of which Node can resolve as a bare/relative import in a plain
   `node` run. Rather than change app-common.js (it must stay exactly as the
   real app needs it), this reads its source as text and swaps just the two
   import lines for the local stubs in tests/stubs/ before evaluating it as
   a module — the same "patch the import, then load" trick used throughout
   this project's own browser-based testing, just aimed at Node instead of
   a page.

   No test framework dependency on purpose: this needs to run with a bare
   `node tests/run.mjs`, with nothing to npm install first.
   ========================================================================== */

import { readFileSync, writeFileSync, mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '..');

// ---- tiny test framework -------------------------------------------------
let pass = 0, fail = 0;
const failures = [];
let currentSuite = '';

function suite(name, fn) { currentSuite = name; fn(); currentSuite = ''; }
function test(name, fn) {
  const label = currentSuite ? `${currentSuite} :: ${name}` : name;
  try {
    fn();
    pass++;
  } catch (err) {
    fail++;
    failures.push({ label, err });
  }
}
async function testAsync(name, fn) {
  const label = currentSuite ? `${currentSuite} :: ${name}` : name;
  try {
    await fn();
    pass++;
  } catch (err) {
    fail++;
    failures.push({ label, err });
  }
}
const assert = {
  equal(actual, expected, msg) {
    if (actual !== expected) throw new Error(`${msg || 'assert.equal failed'}\n    expected: ${JSON.stringify(expected)}\n    actual:   ${JSON.stringify(actual)}`);
  },
  deepEqual(actual, expected, msg) {
    const a = JSON.stringify(actual), e = JSON.stringify(expected);
    if (a !== e) throw new Error(`${msg || 'assert.deepEqual failed'}\n    expected: ${e}\n    actual:   ${a}`);
  },
  ok(value, msg) {
    if (!value) throw new Error(msg || `expected truthy value, got ${JSON.stringify(value)}`);
  },
  throws(fn, msg) {
    try { fn(); } catch { return; }
    throw new Error(msg || 'expected function to throw, it did not');
  }
};

// ---- load app-common.js with its imports patched to the local stubs -----
async function loadAppCommon() {
  let src = readFileSync(join(ROOT, 'app-common.js'), 'utf8');
  const stubConfigUrl = pathToFileURL(join(__dirname, 'stubs', 'firebase-config.js')).href;
  const stubFirestoreUrl = pathToFileURL(join(__dirname, 'stubs', 'firestore.js')).href;
  const towerPlanUrl = pathToFileURL(join(ROOT, 'tower-plan.js')).href;
  const avatarUrl = pathToFileURL(join(ROOT, 'avatar-placeholder.js')).href;
  const uiA11yUrl = pathToFileURL(join(ROOT, 'ui-a11y.js')).href;

  src = src.replace("import { db } from './firebase-config.js';", `import { db } from '${stubConfigUrl}';`);
  src = src.replace(
    /import\s*\{[^}]*\}\s*from\s*"https:\/\/www\.gstatic\.com\/firebasejs\/[^"]*firebase-firestore\.js";/,
    `import { doc, getDoc, setDoc, addDoc, collection, runTransaction, serverTimestamp } from '${stubFirestoreUrl}';`
  );
  // tower-plan.js / avatar-placeholder.js / ui-a11y.js are already plain,
  // dependency-free modules — only their path needs redirecting to the
  // real project root. replaceAll matters here: app-common.js both imports
  // AND re-exports from each of these, so a single .replace() would leave
  // the re-export statement pointing at the original unresolved path.
  src = src.replaceAll("from './tower-plan.js'", `from '${towerPlanUrl}'`);
  src = src.replaceAll("from './avatar-placeholder.js'", `from '${avatarUrl}'`);
  src = src.replaceAll("from './ui-a11y.js'", `from '${uiA11yUrl}'`);

  const tmpDir = mkdtempSync(join(tmpdir(), 'mhmrws-test-'));
  const outPath = join(tmpDir, 'app-common.mjs');
  writeFileSync(outPath, src);
  return import(pathToFileURL(outPath).href);
}

const app = await loadAppCommon();
const fsStub = await import(pathToFileURL(join(__dirname, 'stubs', 'firestore.js')).href);

console.log('MHMRWS Portal — test suite\n');

// ==========================================================================
// Maintenance dues — the core financial calculation every other number in
// the app (defaulters list, treasurer dashboard, fund balance) depends on.
// ==========================================================================
suite('duesFor', () => {
  const settings = { rates: { '2026-27': { default: 6000, byTower: { B: 7200 } } } };
  const member = (tower) => ({ uid: 'm1', tower });

  test('unpaid member owes the full rate', () => {
    const d = app.duesFor(member('A'), [], '2026-27', settings);
    assert.equal(d.expected, 6000);
    assert.equal(d.paid, 0);
    assert.equal(d.outstanding, 6000);
    assert.equal(d.status, 'unpaid');
  });

  test('tower-specific rate overrides the default', () => {
    const d = app.duesFor(member('B'), [], '2026-27', settings);
    assert.equal(d.expected, 7200, 'Tower B has its own rate, not the default');
  });

  test('partial payment leaves the correct outstanding balance', () => {
    const payments = [{ memberUid: 'm1', status: 'verified', financialYear: '2026-27', amount: 2500 }];
    const d = app.duesFor(member('A'), payments, '2026-27', settings);
    assert.equal(d.paid, 2500);
    assert.equal(d.outstanding, 3500);
    assert.equal(d.status, 'partial');
  });

  test('exact payment clears the balance to zero, not negative', () => {
    const payments = [{ memberUid: 'm1', status: 'verified', financialYear: '2026-27', amount: 6000 }];
    const d = app.duesFor(member('A'), payments, '2026-27', settings);
    assert.equal(d.outstanding, 0);
    assert.equal(d.status, 'paid');
  });

  test('overpayment is tracked as its own status, outstanding floors at zero', () => {
    const payments = [{ memberUid: 'm1', status: 'verified', financialYear: '2026-27', amount: 6500 }];
    const d = app.duesFor(member('A'), payments, '2026-27', settings);
    assert.equal(d.outstanding, 0, 'outstanding must never go negative');
    assert.equal(d.status, 'overpaid');
  });

  test('pending/rejected payments do not count toward paid', () => {
    const payments = [
      { memberUid: 'm1', status: 'pending_verification', financialYear: '2026-27', amount: 6000 },
      { memberUid: 'm1', status: 'rejected', financialYear: '2026-27', amount: 6000 }
    ];
    const d = app.duesFor(member('A'), payments, '2026-27', settings);
    assert.equal(d.paid, 0, 'only verified payments should count');
  });

  test('a voided payment does not count toward paid', () => {
    const payments = [{ memberUid: 'm1', status: 'voided', financialYear: '2026-27', amount: 6000 }];
    const d = app.duesFor(member('A'), payments, '2026-27', settings);
    assert.equal(d.paid, 0, 'voided payments must not count as collected');
  });

  test('a different member\'s payment is not counted', () => {
    const payments = [{ memberUid: 'someone-else', status: 'verified', financialYear: '2026-27', amount: 6000 }];
    const d = app.duesFor(member('A'), payments, '2026-27', settings);
    assert.equal(d.paid, 0);
  });

  test('a different financial year\'s payment is not counted', () => {
    const payments = [{ memberUid: 'm1', status: 'verified', financialYear: '2025-26', amount: 6000 }];
    const d = app.duesFor(member('A'), payments, '2026-27', settings);
    assert.equal(d.paid, 0);
  });

  test('no rate configured for the year yields no_rate, not a crash', () => {
    const d = app.duesFor(member('A'), [], '2099-00', settings);
    assert.equal(d.status, 'no_rate');
    assert.equal(d.expected, 0);
  });
});

// ==========================================================================
// Maintenance health grading — the severity classification the Defaulters
// list uses to distinguish "just became due" from "seriously overdue".
// ==========================================================================
suite('maintenanceHealthStatus', () => {
  const settings = { rates: { '2026-27': { default: 6000 } } };

  test('fully paid member is current, regardless of anything else', () => {
    const h = app.maintenanceHealthStatus({ uid: 'm1', tower: 'A' },
      [{ memberUid: 'm1', status: 'verified', financialYear: '2026-27', amount: 6000 }], '2026-27', settings);
    assert.equal(h.level, 'current');
  });

  test('explicit dispute flag always wins, even with zero paid', () => {
    const h = app.maintenanceHealthStatus({ uid: 'm1', tower: 'A', duesDisputed: true }, [], '2026-27', settings);
    assert.equal(h.level, 'disputed', 'a disputed flag must override the automatic grading entirely');
  });

  test('partial payment grades as partial, not unpaid', () => {
    const h = app.maintenanceHealthStatus({ uid: 'm1', tower: 'A' },
      [{ memberUid: 'm1', status: 'verified', financialYear: '2026-27', amount: 3000 }], '2026-27', settings);
    assert.equal(h.level, 'partial');
  });
});

// ==========================================================================
// Payment validation — the gate every resident payment submission passes
// through before it's written to Firestore.
// ==========================================================================
suite('validatePayment', () => {
  test('a valid online payment passes with no error', () => {
    const err = app.validatePayment({ amount: 5000, mode: 'upi', utr: 'ABCD1234EFGH', isOffline: false });
    assert.equal(err, null);
  });

  test('zero amount is rejected', () => {
    const err = app.validatePayment({ amount: 0, mode: 'upi', utr: 'ABCD1234EFGH', isOffline: false });
    assert.ok(err, 'zero must not be a valid payment amount');
  });

  test('negative amount is rejected', () => {
    const err = app.validatePayment({ amount: -500, mode: 'cash', isOffline: true });
    assert.ok(err);
  });

  test('an amount over the hard ceiling is rejected', () => {
    const err = app.validatePayment({ amount: 50000000, mode: 'upi', utr: 'ABCD1234EFGH', isOffline: false });
    assert.ok(err, 'a payment above LIMITS.amountMax must be rejected');
  });

  test('more than two decimal places is rejected', () => {
    const err = app.validatePayment({ amount: 100.999, mode: 'upi', utr: 'ABCD1234EFGH', isOffline: false });
    assert.ok(err);
  });

  test('an online payment without a UTR is rejected', () => {
    const err = app.validatePayment({ amount: 5000, mode: 'upi', utr: '', isOffline: false });
    assert.ok(err, 'online modes require a UTR/reference number');
  });

  test('an offline (cash) payment does not require a UTR', () => {
    const err = app.validatePayment({ amount: 5000, mode: 'cash', utr: '', isOffline: true });
    assert.equal(err, null);
  });

  test('a UTR with symbols is rejected', () => {
    const err = app.validatePayment({ amount: 5000, mode: 'upi', utr: 'ABC-123!', isOffline: false });
    assert.ok(err, 'UTR must be alphanumeric only');
  });

  test('an unrecognized payment mode is rejected', () => {
    const err = app.validatePayment({ amount: 5000, mode: 'bitcoin', utr: 'ABCD1234EFGH', isOffline: false });
    assert.ok(err);
  });
});

// ==========================================================================
// Expense validation and summary — the same category of correctness for
// the spending side of the ledger.
// ==========================================================================
suite('validateExpense / expenseSummary', () => {
  test('a valid expense passes', () => {
    const err = app.validateExpense({ description: 'Lift AMC', amount: 15000, category: 'Lift AMC', mode: 'bank', paidTo: 'Otis' });
    assert.equal(err, null);
  });

  test('an empty description is rejected', () => {
    const err = app.validateExpense({ description: '  ', amount: 1000, category: 'Repairs & Maintenance', mode: 'cash' });
    assert.ok(err);
  });

  test('a zero or negative amount is rejected', () => {
    assert.ok(app.validateExpense({ description: 'x', amount: 0, category: 'Repairs & Maintenance', mode: 'cash' }));
    assert.ok(app.validateExpense({ description: 'x', amount: -100, category: 'Repairs & Maintenance', mode: 'cash' }));
  });

  test('voided expenses are excluded from the spent total', () => {
    const expenses = [
      { financialYear: '2026-27', status: 'approved', amount: 10000, category: 'Repairs & Maintenance', date: '2026-04-01' },
      { financialYear: '2026-27', status: 'voided', amount: 5000, category: 'Repairs & Maintenance', date: '2026-04-02' }
    ];
    const s = app.expenseSummary(expenses, '2026-27');
    assert.equal(s.total, 10000, 'a voided expense must not count as spent');
  });

  test('pending and rejected requests are excluded from the spent total', () => {
    const expenses = [
      { financialYear: '2026-27', status: 'pending_approval', amount: 10000, category: 'Repairs & Maintenance', date: '2026-04-01' },
      { financialYear: '2026-27', status: 'rejected', amount: 5000, category: 'Repairs & Maintenance', date: '2026-04-02' }
    ];
    const s = app.expenseSummary(expenses, '2026-27');
    assert.equal(s.total, 0);
  });

  test('a legacy expense with no status field counts as approved', () => {
    const expenses = [{ financialYear: '2026-27', amount: 8000, category: 'Repairs & Maintenance', date: '2026-04-01' }];
    const s = app.expenseSummary(expenses, '2026-27');
    assert.equal(s.total, 8000, 'pre-workflow expenses (no status field) must still count');
  });

  test('a different financial year\'s expense is excluded', () => {
    const expenses = [{ financialYear: '2025-26', status: 'approved', amount: 8000, category: 'Repairs & Maintenance', date: '2025-04-01' }];
    const s = app.expenseSummary(expenses, '2026-27');
    assert.equal(s.total, 0);
  });
});

// ==========================================================================
// Fund position — collected minus spent, the number the Treasurer Dashboard
// and public transparency page both build on.
// ==========================================================================
suite('fundPosition', () => {
  test('balance is exactly collected minus spent', () => {
    const payments = [{ status: 'verified', financialYear: '2026-27', amount: 800000 }];
    const expenses = [{ status: 'approved', financialYear: '2026-27', amount: 550000, category: 'Repairs & Maintenance', date: '2026-04-01' }];
    const pos = app.fundPosition(payments, expenses, '2026-27');
    assert.equal(pos.collected, 800000);
    assert.equal(pos.spent, 550000);
    assert.equal(pos.balance, 250000);
  });

  test('an overspent year produces a genuinely negative balance, not zero', () => {
    const payments = [{ status: 'verified', financialYear: '2026-27', amount: 100000 }];
    const expenses = [{ status: 'approved', financialYear: '2026-27', amount: 150000, category: 'Repairs & Maintenance', date: '2026-04-01' }];
    const pos = app.fundPosition(payments, expenses, '2026-27');
    assert.equal(pos.balance, -50000, 'an overspent position must show as negative, not clamp to zero — hiding it would mislead the treasurer');
  });
});

// ==========================================================================
// Receipt sequencing atomicity — the fix verified extensively in-browser
// during development; this locks the same guarantee in as a permanent,
// automated regression test.
// ==========================================================================
await (async () => {
  currentSuite = 'generateReceiptNumberAtomic';

  await testAsync('allocates sequential numbers starting from 1', async () => {
    fsStub.__resetStore();
    const r1 = await app.generateReceiptNumberAtomic('2026-27', (tx, num) => { tx.set({ p: 'payments/p1' }, { receiptNumber: num }); });
    const r2 = await app.generateReceiptNumberAtomic('2026-27', (tx, num) => { tx.set({ p: 'payments/p2' }, { receiptNumber: num }); });
    assert.equal(r1, 'MHMRWS-2026-000001');
    assert.equal(r2, 'MHMRWS-2026-000002');
  });

  await testAsync('a failure inside writeFn leaves the counter untouched (no burned number)', async () => {
    fsStub.__resetStore();
    await app.generateReceiptNumberAtomic('2026-27', (tx, num) => { tx.set({ p: 'payments/ok' }, { receiptNumber: num }); });
    try {
      await app.generateReceiptNumberAtomic('2026-27', () => { throw new Error('simulated failure'); });
    } catch { /* expected */ }
    const retryNum = await app.generateReceiptNumberAtomic('2026-27', (tx, num) => { tx.set({ p: 'payments/retry' }, { receiptNumber: num }); });
    assert.equal(retryNum, 'MHMRWS-2026-000002', 'the failed attempt must not have consumed a number — this must be #2, not #3');
  });

  await testAsync('different financial years get independent sequences', async () => {
    fsStub.__resetStore();
    const a = await app.generateReceiptNumberAtomic('2026-27', (tx, num) => { tx.set({ p: 'payments/a' }, { n: num }); });
    const b = await app.generateReceiptNumberAtomic('2027-28', (tx, num) => { tx.set({ p: 'payments/b' }, { n: num }); });
    assert.equal(a, 'MHMRWS-2026-000001');
    assert.equal(b, 'MHMRWS-2027-000001', 'a new FY must start its own counter at 1, not continue the previous year\'s');
  });

  currentSuite = '';
})();

// ==========================================================================
// Pet vaccination status — the reminder logic that drives both the admin
// dashboard widget and the resident's own "My Pets" view.
// ==========================================================================
suite('petVaccinationStatus', () => {
  const daysFromNow = (n) => { const d = new Date(); d.setDate(d.getDate() + n); return d.toISOString().slice(0, 10); };

  test('a date 60 days out is fine, not flagged', () => {
    const s = app.petVaccinationStatus({ nextVaccinationDue: daysFromNow(60) });
    assert.equal(s.status, 'fine');
  });

  test('a date 10 days out is due_soon', () => {
    const s = app.petVaccinationStatus({ nextVaccinationDue: daysFromNow(10) });
    assert.equal(s.status, 'due_soon');
  });

  test('a date in the past is overdue', () => {
    const s = app.petVaccinationStatus({ nextVaccinationDue: daysFromNow(-5) });
    assert.equal(s.status, 'overdue');
    assert.ok(s.daysUntil < 0, 'daysUntil should be negative for an overdue date');
  });

  test('no date set at all is its own distinct status, not "fine"', () => {
    const s = app.petVaccinationStatus({});
    assert.ok(s.status !== 'fine' && s.status !== 'overdue' && s.status !== 'due_soon');
  });
});

// ==========================================================================
// Security-relevant: HTML escaping. Every user-supplied string (names,
// complaint text, notice titles) is rendered through this — if it's wrong,
// it's a stored-XSS hole across the entire app, not a cosmetic bug.
// ==========================================================================
suite('escapeHtml', () => {
  test('a script tag is neutralized', () => {
    const out = app.escapeHtml('<script>alert(1)</script>');
    assert.ok(!out.includes('<script>'), 'a raw <script> tag must never survive escaping');
  });

  test('an attribute-breakout attempt is neutralized', () => {
    const out = app.escapeHtml('"><img src=x onerror=alert(1)>');
    assert.ok(!out.includes('"><img'), 'quote characters must be escaped to prevent breaking out of an attribute');
  });

  test('an ampersand is escaped (and only once)', () => {
    const out = app.escapeHtml('Tom & Jerry');
    assert.equal(out, 'Tom &amp; Jerry');
  });

  test('ordinary text passes through unchanged', () => {
    assert.equal(app.escapeHtml('Ramesh Kumar'), 'Ramesh Kumar');
  });

  test('non-string input does not throw', () => {
    assert.equal(app.escapeHtml(null), '');
    assert.equal(app.escapeHtml(undefined), '');
  });
});

// ==========================================================================
// Currency formatting — every rupee figure on every screen goes through
// this; a locale/rounding bug here is systemic, not local.
// ==========================================================================
suite('formatINR', () => {
  test('uses Indian digit grouping, not Western thousands', () => {
    assert.equal(app.formatINR(1000000), '₹10,00,000', 'ten lakh must group as 10,00,000, not 1,000,000');
  });

  test('handles zero', () => {
    assert.equal(app.formatINR(0), '₹0');
  });

  test('rounds to whole rupees for display', () => {
    const out = app.formatINR(1234.5);
    assert.ok(!out.includes('.5'), 'display formatting should not leak fractional paise');
  });
});

// ==========================================================================
// Flat/tower validation — the gate that keeps a resident from claiming a
// flat that doesn't exist in the real building plan.
// ==========================================================================
suite('isValidFlat', () => {
  test('a real flat number in a real tower is valid', () => {
    const anyTower = app.TOWER_IDS[0];
    const anyFlat = app.flatsForTower(anyTower)[0].flats[0];
    assert.ok(app.isValidFlat(anyTower, anyFlat));
  });

  test('a nonexistent flat number is rejected', () => {
    assert.equal(app.isValidFlat(app.TOWER_IDS[0], 'ZZ-9999'), false);
  });

  test('a nonexistent tower is rejected', () => {
    assert.equal(app.isValidFlat('NOT-A-REAL-TOWER', '101'), false);
  });
});

// ==========================================================================
// Public verification tokens — must be unpredictable (128-bit random hex,
// per MIGRATION.md's stated security model), not guessable/sequential.
// ==========================================================================
suite('newPublicToken', () => {
  test('produces a 32-character hex string (128 bits)', () => {
    const t = app.newPublicToken();
    assert.ok(/^[0-9a-f]{32}$/.test(t), `expected 32 lowercase hex chars, got: ${t}`);
  });

  test('two calls produce different tokens', () => {
    const a = app.newPublicToken();
    const b = app.newPublicToken();
    assert.ok(a !== b, 'tokens must not collide/repeat on consecutive calls');
  });
});

// ==========================================================================
// Security-relevant: URL sanitization. escapeHtml alone stops a URL from
// breaking out of the href attribute, but says nothing about a dangerous
// scheme — this is the check that stops a bill link or document URL from
// ever being saved as javascript:... in the first place.
// ==========================================================================
suite('sanitizeUrl', () => {
  test('a normal https URL passes through unchanged', () => {
    assert.equal(app.sanitizeUrl('https://drive.google.com/file/d/abc'), 'https://drive.google.com/file/d/abc');
  });

  test('a normal http URL passes through unchanged', () => {
    assert.equal(app.sanitizeUrl('http://example.com/bill.pdf'), 'http://example.com/bill.pdf');
  });

  test('a javascript: scheme is rejected', () => {
    assert.equal(app.sanitizeUrl('javascript:alert(document.cookie)'), '', 'a javascript: URL must never be accepted, escaped or not');
  });

  test('a data: scheme is rejected', () => {
    assert.equal(app.sanitizeUrl('data:text/html,<script>alert(1)</script>'), '');
  });

  test('a bare relative path is rejected (must be an absolute http(s) URL)', () => {
    assert.equal(app.sanitizeUrl('/some/path'), '');
  });

  test('empty and non-string input do not throw', () => {
    assert.equal(app.sanitizeUrl(''), '');
    assert.equal(app.sanitizeUrl(null), '');
    assert.equal(app.sanitizeUrl(undefined), '');
  });

  test('leading/trailing whitespace is trimmed', () => {
    assert.equal(app.sanitizeUrl('  https://example.com  '), 'https://example.com');
  });
});

// ==========================================================================
// Security-relevant: storage filenames. A user-chosen filename should never
// become part of a Storage object key — this only keeps a safe-looking
// extension and replaces everything else with a random token.
// ==========================================================================
suite('safeStorageFilename', () => {
  test('keeps a normal, safe extension', () => {
    const out = app.safeStorageFilename('bill-receipt.pdf');
    assert.ok(out.endsWith('.pdf'), `expected a .pdf extension, got: ${out}`);
  });

  test('the original name itself does not survive into the result', () => {
    const out = app.safeStorageFilename('bill-receipt.pdf');
    assert.ok(!out.includes('bill-receipt'), 'the original filename text must not appear in the generated key');
  });

  test('lowercases the extension', () => {
    const out = app.safeStorageFilename('Photo.JPG');
    assert.ok(out.endsWith('.jpg'), `expected lowercase .jpg, got: ${out}`);
  });

  test('a path-traversal-style name produces a clean result with no ../ in it', () => {
    const out = app.safeStorageFilename('../../../etc/passwd.pdf');
    assert.ok(!out.includes('..') && !out.includes('/'), `expected no path segments to survive, got: ${out}`);
  });

  test('a name with no recognizable extension gets none, not a garbled tail', () => {
    const out = app.safeStorageFilename('no_extension_here');
    assert.ok(!out.includes('no_extension_here'));
  });

  test('two calls for the same original name produce different keys', () => {
    const a = app.safeStorageFilename('same-name.pdf');
    const b = app.safeStorageFilename('same-name.pdf');
    assert.ok(a !== b, 'each upload must get its own random key, even for the same original filename');
  });

  test('empty/missing input does not throw', () => {
    assert.ok(app.safeStorageFilename('') !== undefined);
    assert.ok(app.safeStorageFilename(undefined) !== undefined);
  });
});

// ---- summary --------------------------------------------------------------
console.log(`\n${pass} passed, ${fail} failed\n`);
if (failures.length) {
  console.log('Failures:\n');
  for (const f of failures) {
    console.log(`  ✗ ${f.label}`);
    console.log(`    ${String(f.err.message || f.err).split('\n').join('\n    ')}\n`);
  }
  process.exit(1);
}
process.exit(0);

