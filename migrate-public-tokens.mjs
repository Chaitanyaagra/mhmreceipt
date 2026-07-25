#!/usr/bin/env node
/* ==========================================================================
   MHMRWS Portal — backfill public verification tokens
   ==========================================================================
   Members and payments created before the hardening release have no
   `publicToken`, and their public verification documents are keyed by the
   sequential Member ID / Receipt Number — which means they can be enumerated.
   This script gives each one a random token and writes a token-keyed copy of
   the public record.

   It does NOT delete the old, sequentially-keyed documents unless you pass
   --purge-legacy, because deleting them stops every receipt and membership
   card already printed from verifying. See MIGRATION.md, section 4.

   Usage:
     npm install firebase-admin
     node migrate-public-tokens.mjs --dry-run
     node migrate-public-tokens.mjs
     node migrate-public-tokens.mjs --purge-legacy

   Requires serviceAccountKey.json in the parent directory. That key bypasses
   security rules entirely — treat it like a password and delete it afterwards.
   ========================================================================== */

import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';
import { initializeApp, cert } from 'firebase-admin/app';
import { getFirestore, FieldValue } from 'firebase-admin/firestore';

const DRY_RUN = process.argv.includes('--dry-run');
const PURGE   = process.argv.includes('--purge-legacy');

const KEY_PATH = new URL('../serviceAccountKey.json', import.meta.url);
let serviceAccount;
try {
  serviceAccount = JSON.parse(readFileSync(KEY_PATH, 'utf8'));
} catch (e) {
  console.error('Could not read serviceAccountKey.json in the project root.');
  console.error('Firebase Console -> Project settings -> Service accounts -> Generate new private key');
  process.exit(1);
}

initializeApp({ credential: cert(serviceAccount) });
const db = getFirestore();

/* Must match newPublicToken() in app-common.js and isPublicToken() in
   firestore.rules: 32 lowercase hex characters. */
const newPublicToken = () => randomBytes(16).toString('hex');

const say = (...a) => console.log(DRY_RUN ? '[dry-run]' : '[apply]  ', ...a);

/* Firestore batches cap at 500 writes. */
async function commitInChunks(writes) {
  if (DRY_RUN) return writes.length;
  let done = 0;
  for (let i = 0; i < writes.length; i += 400) {
    const batch = db.batch();
    for (const w of writes.slice(i, i + 400)) w(batch);
    await batch.commit();
    done += Math.min(400, writes.length - i);
    process.stdout.write(`\r  committed ${done}/${writes.length}`);
  }
  if (done) process.stdout.write('\n');
  return done;
}

async function migrateMembers() {
  console.log('\n=== members ===');
  const snap = await db.collection('members').get();
  const writes = [];
  let skipped = 0;

  for (const d of snap.docs) {
    const m = d.data();
    if (m.publicToken) { skipped++; continue; }
    // Only approved members have a public record to move.
    if (!m.memberID || m.status !== 'approved') { skipped++; continue; }

    const token = newPublicToken();
    say(`member ${m.memberID}  ${m.tower}/${m.flatNumber}  ->  ${token}`);

    writes.push((b) => b.update(d.ref, { publicToken: token }));
    writes.push((b) => b.set(db.collection('membersPublic').doc(token), {
      memberID: m.memberID,
      name: m.name || '',
      tower: m.tower || '',
      flatNumber: m.flatNumber || '',
      residentType: m.residentType || '',
      status: m.status,
      updatedAt: FieldValue.serverTimestamp()
    }));
    if (PURGE) {
      writes.push((b) => b.delete(db.collection('membersPublic').doc(m.memberID)));
    }
  }

  const n = await commitInChunks(writes);
  console.log(`  ${writes.length ? writes.length : 0} writes queued, ${n} applied, ${skipped} already fine or not applicable`);
}

async function migratePayments() {
  console.log('\n=== payments ===');
  const snap = await db.collection('payments').where('status', '==', 'verified').get();
  const writes = [];
  let skipped = 0;

  for (const d of snap.docs) {
    const p = d.data();
    if (p.publicToken) { skipped++; continue; }
    if (!p.receiptNumber) { skipped++; continue; }

    const token = newPublicToken();
    say(`receipt ${p.receiptNumber}  ${p.residentName}  ->  ${token}`);

    writes.push((b) => b.update(d.ref, { publicToken: token }));
    writes.push((b) => b.set(db.collection('receiptsPublic').doc(token), {
      receiptNumber: p.receiptNumber,
      residentName: p.residentName || '',
      flatNumber: p.flatNumber || '',
      tower: p.tower || '',
      amount: p.amount,
      financialYear: p.financialYear || '',
      verifiedAt: p.verifiedAt || FieldValue.serverTimestamp(),
      status: 'Verified'
    }));
    if (PURGE) {
      writes.push((b) => b.delete(db.collection('receiptsPublic').doc(p.receiptNumber)));
    }
  }

  const n = await commitInChunks(writes);
  console.log(`  ${writes.length} writes queued, ${n} applied, ${skipped} already fine or not applicable`);
}

/* Approvals now reserve a flat. Existing approved members predate that, so
   backfill the claims — and report any duplicate flats rather than guessing
   which record is the real one. */
async function backfillFlatClaims() {
  console.log('\n=== flat claims ===');
  const snap = await db.collection('members').where('status', '==', 'approved').get();
  const byFlat = new Map();

  for (const d of snap.docs) {
    const m = d.data();
    if (!m.tower || !m.flatNumber) continue;
    const key = `${String(m.tower).trim()}_${String(m.flatNumber).trim()}`;
    if (!byFlat.has(key)) byFlat.set(key, []);
    byFlat.get(key).push({ id: d.id, ...m });
  }

  const writes = [];
  const duplicates = [];
  for (const [key, members] of byFlat) {
    if (members.length > 1) {
      duplicates.push({ key, members });
      continue;   // never auto-pick a winner
    }
    const m = members[0];
    say(`claim ${key} -> ${m.memberID || m.id}`);
    writes.push((b) => b.set(db.collection('flatClaims').doc(key), {
      tower: m.tower, flatNumber: m.flatNumber,
      memberDocId: m.id, memberUid: m.uid || null,
      memberID: m.memberID || null,
      claimedAt: FieldValue.serverTimestamp()
    }, { merge: true }));
  }

  const n = await commitInChunks(writes);
  console.log(`  ${writes.length} claims queued, ${n} applied`);

  if (duplicates.length) {
    console.log(`\n  !! ${duplicates.length} flats have more than one approved member.`);
    console.log('     No claim was written for these — decide which record is correct,');
    console.log('     deactivate the other in the Admin Panel, then re-run this script.\n');
    for (const { key, members } of duplicates) {
      console.log(`     ${key}:`);
      for (const m of members) console.log(`       - ${m.memberID || '(no ID)'}  ${m.name}  (doc ${m.id})`);
    }
  }
}

console.log(DRY_RUN ? 'DRY RUN — nothing will be written.' : 'APPLYING CHANGES.');
if (PURGE && !DRY_RUN) {
  console.log('\n!! --purge-legacy is on. Receipts and membership cards printed before');
  console.log('   this migration will STOP verifying. Ctrl-C now if that is not what');
  console.log('   you meant. Continuing in 10 seconds...\n');
  await new Promise((r) => setTimeout(r, 10000));
}

await migrateMembers();
await migratePayments();
await backfillFlatClaims();

console.log('\nDone.');
if (DRY_RUN) console.log('That was a dry run — re-run without --dry-run to apply.');
process.exit(0);
