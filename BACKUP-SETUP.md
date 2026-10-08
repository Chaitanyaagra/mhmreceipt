# Automatic nightly backup — one-time setup (about 15 minutes)

**Kya hoga:** har raat 2:00 baje GitHub ek job chalayega jo society ka poora Firebase data
(members, payments, expenses, complaints, polls, notices… sab kuch) padhega, aapke **passphrase se
encrypt** karega, aur ek **alag private repository** mein save kar dega. Aapko kuch yaad nahi
rakhna. Admin panel ke *Settings & Backup* mein "Last backup: today · Automatic nightly backup"
dikhega, aur agar 3 din tak backup na bane to Overview par laal **"Backup needs attention"** row aayegi.

**Kya backup NAHI hota:** Firebase *Storage* ki files — resident photos, ID documents, payment
screenshots. Wo database ka hissa nahi hain. (Unke links backup mein hain, files nahi.)

> Ye sab sirf **Super Admin / jiske paas GitHub repository ka admin access ho** kar sakta hai.

---

## Step 1 — Private backup repository banayein

1. GitHub par login karke <https://github.com/new> kholein.
2. Repository name: `mhmrws-backups` (kuch bhi chalega).
3. **Private** select karein (zaroori!). "Add a README" tick na karein. **Create repository.**

## Step 2 — Backup repository ke liye access token banayein

1. GitHub → upar-daayen profile photo → **Settings** → sabse neeche **Developer settings**
   → **Personal access tokens** → **Fine-grained tokens** → **Generate new token**.
2. Token name: `mhmrws-backup`. Expiration: **1 year** (calendar mein reminder lagayein — Step 7 dekhein).
3. **Repository access → Only select repositories →** sirf `mhmrws-backups`.
4. **Permissions → Repository permissions → Contents → Read and write.** (Aur kuch nahi.)
5. **Generate token** → dikhne wala token (`github_pat_…`) abhi copy karke rakh lein. Dobara nahi dikhega.

## Step 3 — Firebase ki service-account key banayein

1. Firebase Console → apna project → ⚙ **Project settings** → **Service accounts** tab.
2. **Generate new private key** → **Generate key.** Ek `.json` file download hogi.
3. Is file ko **kisi ko mat bhejein, repository mein upload mat karein.** Isse poora database padha ja sakta hai.
   Sirf Step 5 mein GitHub *secret* mein paste karni hai, phir computer se delete kar dein.

## Step 4 — Passphrase chunein

Ek lamba passphrase (kam se kam 12 akshar, jaise 4–5 shabdon ka vakya). Isi se backup lock hoga.

> ⚠️ **Passphrase kho gaya to backup kabhi nahi khulega — Anthropic, GitHub, koi bhi nahi khol sakta.**
> Use kaagaz par likhkar President/Treasurer ke paas alag jagah rakhein, backup se alag.

## Step 5 — Chaar "secrets" daalein

Jis repository mein ye app hai (jahan se website chalti hai) → **Settings → Secrets and variables →
Actions → New repository secret.** Chaar secret banayein (naam bilkul aise):

| Name | Value |
|---|---|
| `FIREBASE_SERVICE_ACCOUNT` | Step 3 wali `.json` file ka **poora** text (`{` se `}` tak) |
| `BACKUP_PASSPHRASE` | Step 4 ka passphrase |
| `BACKUP_REPO` | `aapka-github-naam/mhmrws-backups` |
| `BACKUP_REPO_TOKEN` | Step 2 ka token (`github_pat_…`) |

## Step 6 — Files upload karein aur ek baar chalakar dekhein

1. Is zip ki saari files apni repository mein upload karein (jaise pehle karte the). Dhyan dein ki
   ye do cheezein bhi jaayein: **`.github/workflows/backup.yml`** aur **`scripts/`** folder.
   - Agar GitHub ka upload `.github` folder chhod de: **Add file → Create new file**, naam mein
     `.github/workflows/backup.yml` likhein (slash likhne par folder ban jaata hai), aur zip wali
     `backup.yml` ka text paste karke Commit karein.
2. Repository ke **Actions** tab par jayein. Pehli baar "I understand my workflows, go ahead and
   enable them" dikhe to enable karein.
3. Left mein **Automatic backup** → **Run workflow** → **Run workflow** (green button).
4. 2–3 minute baad hara ✔ aana chahiye. Phir `mhmrws-backups` repository kholein — wahan
   `latest.json.enc` aur `status.json` dikhne chahiye.
5. Admin panel → **Settings & Backup** → "Last backup was today · Automatic nightly backup".

Bas. Ab har raat apne aap chalega.

## Step 7 — Saal mein ek baar (zaroori)

Token (Step 2) 1 saal mein expire hota hai. Expire hote hi backup chupchaap ruk jaayega — par app
3 din baad Overview par laal **"Backup needs attention"** dikhayegi. Tab: naya token banayein
(Step 2) aur `BACKUP_REPO_TOKEN` secret ko naye token se badal dein (Step 5, secret ke saamne pencil icon).
Calendar mein 11 mahine baad ka reminder abhi laga lein.

Agar backup ruk jaaye to **Actions** tab mein laal ✗ wali run kholein — error ka kaaran wahan likha hota hai
(jaise "secret not set", "token expired", ya "database looks much smaller" — iska matlab
data ghat gaya hai; pehle check karein ki kya galti se kuch delete hua. Sach mein theek hai to
**Run workflow** mein *force* tick karke chalayein).

---

## Backup kholna (decrypt) aur restore

**Dekhna/kholna (aasan tareeka):** `mhmrws-backups` se `latest.json.enc` download karein → admin panel →
Settings & Backup → **Decrypt a backup file** → file chunein → apna passphrase daalein → JSON download hoga.

**Restore (sirf emergency mein, kisi technical vyakti ke saath):**

```bash
cd scripts && npm install
export BACKUP_PASSPHRASE='aapka passphrase'
node restore.mjs ../latest.json.enc                     # pehle sirf dekhein — kuch likhta nahi
export FIREBASE_SERVICE_ACCOUNT="$(cat key.json)"
node restore.mjs ../latest.json.enc --only=members,payments --apply --project=<firebase-project-id>
```

- Bina `--apply` ke ye sirf batata hai ki kya likhega.
- Ye maujooda documents ko backup wale se **overwrite** karta hai; jo documents backup mein nahi hain unhe **delete nahi** karta.
- Timestamps, dates waise hi wapas aate hain jaise the.
- Photos/ID documents (Storage) isse wapas nahi aate — unke liye neeche **Part 2 — Files** dekhein.

## Restore drill — backup sach mein khulta hai ya nahi (ek baar zaroor karein)

Backup tabhi kaam ka hai jab wapas khul sake. Do jaanch hain:

1. **Roz apne aap:** script har raat apni banayi file ko dobara decrypt karke ginti milati hai
   (log mein "Restore check passed"). Na mile to wo backup save hi nahi karti, purana bacha rehta hai.
2. **Aap haath se (pehli baar, phir saal mein ek-do baar):** `mhmrws-backups` se `latest.json.enc` download karein
   → admin panel → Settings & Backup → **Decrypt a backup file** → file chunein, passphrase daalein →
   **Check what's inside**. Hara "Backup is readable ✓" aur members/payments ki ginti dikhni chahiye.
   Ginti aapke asli aankdon se mel khaye — tab backup bharose ke laayak hai. (Isme kuch download nahi hota.)

---

## Part 2 — Files (photos, ID documents, payment screenshots) ka backup

Upar wala backup sirf database ka hai. Photos aur documents Firebase **Storage** mein rehte hain —
unke liye alag weekly job hai (`backup-files.yml`). Har file alag se encrypt hoti hai, aur file ke naam
bhi encrypted list mein rehte hain. Pehli baar sab copy hota hai; uske baad sirf nayi/badli hui files.

1. Ek aur **Private** repository banayein: `mhmrws-files-backup` (Step 1 jaisa).
2. Step 2 wale token ki settings mein jaakar **Repository access** mein ye dusri repository bhi jod dein
   (Contents → Read and write). Naya token banane ki zaroorat nahi.
3. Main repository → Settings → Secrets and variables → Actions → naya secret
   **`BACKUP_FILES_REPO`** = `aapkaGitHubNaam/mhmrws-files-backup`. (Baaki secrets wahi rahenge.)
4. **`.github/workflows/backup-files.yml`** aur naya `scripts/` folder upload karein (Step 6 jaisa).
5. Actions → **Automatic files backup** → **Run workflow**. Pehli baar kuch minute se lekar ek ghanta tak
   lag sakta hai. Hara ✔ aane par admin panel ke backup card mein "Photos & documents (Storage): copied 0 day(s) ago" dikhega.
6. Har Sunday raat (Monday 3 AM) apne aap chalega. 10 din tak na chale to panel batayega.

**Limits (jaan lein):** 50 MB se badi single file chhod di jaati hai (ginti panel mein dikhti hai).
Repository ka kul size ~900 MB tak; usse upar jaane par job laal ✗ hokar rukti hai aur batati hai —
tab naya files repository banakar `BACKUP_FILES_REPO` badal dein. Storage se delete hui file
backup mein **bachi rehti hai**.

**Wapas laana:** `mhmrws-files-backup` ko computer par clone karke:

```bash
cd scripts && npm install
export BACKUP_PASSPHRASE='aapka passphrase'
node restore-files.mjs ../../mhmrws-files-backup ./restored --prefix=idproofs/     # --prefix na dein to sab
```

Files `./restored` mein unke asli folder-naam ke saath khulti hain; unhe Firebase Console se wapas upload karein.

---

## Suraksha ke baare mein

- Backup **encrypted** hai (AES-256, wahi tareeka jo admin panel ka "Encrypted download" use karta hai).
  Fir bhi repository **private** rakhein.
- Is repository ke *Actions logs* public ho sakte hain — script log mein sirf collection ke naam aur
  ginti likhta hai, kisi resident ka koi data nahi.
- Agar service-account key kabhi leak ho jaaye: Firebase Console → Project settings → Service accounts →
  Manage service account permissions → us key ko delete karein, aur nayi banakar secret badal dein.
- Weekly (har Sunday) ki ek alag copy `weekly/` mein rakhi jaati hai — pichhle 26 hafte ki. Roz ki
  `latest.json.enc` har raat overwrite hoti hai (Git history mein purane versions bhi rehte hain).
