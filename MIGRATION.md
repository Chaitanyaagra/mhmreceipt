# MIGRATION — security hardening release

Read this before deploying. Most of it is "deploy in this order"; there is one
optional script at the end.

---

## 1. Deploy order matters

**Deploy the site first, then the rules.** Not the other way round.

The new rules require a `publicToken` on any payment being marked verified, and
a verified email address before a resident can file a payment. Only the new
code writes those. If the rules go up first, a treasurer with the old page
still cached gets a permission error in the middle of issuing a receipt.

```
1. git push            → GitHub Pages redeploys index/admin/verify + JS
2. Hard-refresh the admin panel once (Ctrl-Shift-R) so the new
   service worker takes over — it is network-first, so this is quick.
3. Firebase Console → Firestore → Rules → paste firestore.rules → Publish
4. Firebase Console → Storage   → Rules → paste storage.rules   → Publish
```

Paste the rules into the Console editor rather than deploying blind: it
compiles as you type and will point at the exact line if anything is wrong.

The rules ship as separate files and are **no longer published to the live
site** (see `.github/workflows/deploy.yml`), so you have to copy them from the
repo, not from the URL.

---

## 2. What will change for residents, immediately

**Residents who have not verified their email cannot file a payment.** That is
the point of the change, but it will generate questions, so it is worth a
WhatsApp message to the group before you deploy.

The dashboard now shows a banner with a "Link dobara bhejein" (resend) button
for anyone in that position, so it is self-service — nobody has to come to the
office. New registrations get the verification mail automatically.

If a resident says the mail never arrived: Firebase Console → Authentication →
Templates → Email address verification. Check the sender domain and that the
template is enabled. The mail very often lands in spam on first send.

---

## 3. One flat, one member

Approval now writes a `flatClaims/{tower}_{flat}` document, and refuses if that
flat is already claimed. Rejecting or deactivating a member releases it.

**This is not applied retroactively.** Members approved before this release
have no claim document, so the first person approved for any given flat after
the upgrade will succeed even if a duplicate already exists. If you want the
existing duplicates found, sort the members table by flat and look — with 454
flats that is a ten-minute job and more reliable than a script guessing which
of two records is the real one.

---

## 4. Public verification tokens — the enumeration fix

Receipt and card QR codes used to carry the sequential number, and the public
collections were keyed by it. Anyone could request `MHM-2026-000001`,
`000002`, `000003` … and collect the whole resident directory, or walk the
receipt numbers and total up the society's income.

New receipts and cards carry a 128-bit random token instead. `verify.html`
still accepts the old `?receipt=` and `?member=` links, **so every receipt and
card already in a resident's hands keeps working.**

That backwards compatibility is also the catch: the old documents are still
keyed by the sequential number, so **records issued before this release remain
enumerable** until you migrate them.

### Deciding whether to migrate

| | Keep legacy docs | Purge them |
|---|---|---|
| Old printed receipts / cards | keep verifying | stop verifying |
| Old records enumerable | yes | no |

The sensible sequence for most societies:

1. Run the migration **without** `--purge-legacy` now. Every member and
   payment gets a token, so all *newly downloaded* cards and receipts are safe.
2. Ask residents to re-download their membership card (one line in the
   WhatsApp group — the button is on their dashboard).
3. A month later, run it again **with** `--purge-legacy`.

### Running it

The script needs a service account key, which bypasses security rules — so
treat that file like a password, and delete it when you are done.

```bash
# Firebase Console → Project settings → Service accounts
#   → "Generate new private key" → save as serviceAccountKey.json

cd tools
npm install firebase-admin
node migrate-public-tokens.mjs --dry-run          # shows what it would do
node migrate-public-tokens.mjs                    # backfill tokens
node migrate-public-tokens.mjs --purge-legacy     # later: remove old keys

rm ../serviceAccountKey.json
```

**Take a backup first** — Admin Panel → Import/Export → Download Backup.

---

## 5. Turn on App Check

Not done for you, because it needs a key only you can create. It is the single
biggest remaining improvement and it is free. Instructions are in the comment
block in `firebase-config.js`. Until you do it, anyone can talk to your
Firebase project directly from a script — the rules will refuse them, but you
pay for every refused request.

---

## 6. After deploying, check the console once

The new Content-Security-Policy is deliberately tight. Open the site, press
F12, and look at the Console tab for any `Refused to ...` messages. Anything
legitimate that the policy blocks will say so there, and the fix is to add that
domain to the matching directive in the `<meta http-equiv>` block at the top of
the page. Check all three pages: `index.html`, `admin.html`, `verify.html`.
