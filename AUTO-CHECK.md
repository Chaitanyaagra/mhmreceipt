# Har upload par apne aap jaanch (GitHub Actions)

`.github/workflows/test.yml` har baar jab aap files upload (commit) karte hain, apne aap ye chalata hai:

1. **App tests** — hisaab, receipts, backup jaise saare logic ke tests.
2. **Browser tests** — resident aur admin screens asli browser mein.
3. **Start-up test (asli Firebase ke saath)** — har page ka login chalta hai ya nahi. Agar koi file adhoori ya galat upload hui
   (jaise "login dabate hi page khali ho jaata hai"), to yahan laal ✗ aa jaata hai.
4. **Security-rules tests** — Firestore ke niyam (kaun kya padh/likh sakta hai), Firebase emulator par.

**Kaise dekhein:** GitHub repository → **Actions** tab → sabse upar wali run.
- Hara ✔ = sab theek, upload surakshit hai.
- Laal ✗ = kuch tuta. Run kholein, laal step par click karein — wahan likha hota hai kya fail hua. Wo likha hua mujhe bhej dein.

**Setup:** kuch nahi. Bas `.github/workflows/test.yml` upload ho (GitHub ka "Upload files" `.github` folder kabhi chhod deta hai —
tab "Add file → Create new file" mein naam `.github/workflows/test.yml` likhkar text paste karein, jaise `BACKUP-SETUP.md` Step 6 mein bataya hai).
Koi secret ya password nahi chahiye, aur ye kuch deploy nahi karta.

Kisi bhi run ko haath se chalane ke liye: Actions → **Tests** → **Run workflow**.
