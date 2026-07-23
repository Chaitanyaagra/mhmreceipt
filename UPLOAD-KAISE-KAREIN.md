# UPLOAD KAISE KAREIN — Zaroori Padhein

Aapki live site abhi bhi **sabse pehla version** chala rahi hai. Redesign, logo fix, mobile fix, Hindi — inme se kuch bhi upload nahi hua tha. Isliye logo nahi dikh raha tha aur building bhi nahi.

Ab **saari files root mein hain** — koi folder nahi banana padega. Yahi wajah thi ki `assets/` folder pehle upload nahi ho paata tha.

---

## Pehle: check karein ki purana version hi hai ya nahi

GitHub par apni repo kholein aur file list dekhein. Agar **`logo-data.js`** naam ki file **nahi dikh rahi**, matlab naya version kabhi upload hi nahi hua.

---

## Upload karne ka sabse pakka tareeka

1. Zip ko apne computer par **extract** karein (zip file khud upload mat karein — GitHub usse kholta nahi hai)

2. GitHub par apni repo kholein → **"Add file"** → **"Upload files"**

3. Extract ki hui folder **khol lein**. Andar **20 files** dikhengi. **Saari 20 select karein** (`Ctrl+A` ya `Cmd+A`) aur browser window mein drag kar dein.
   - **Folder ko drag mat karein** — folder ke *andar ki files* drag karni hain

4. Neeche scroll karein. Ek box hoga "Commit changes" ka — **us button ko zaroor dabayein**. Yeh step chhoot jaana sabse aam galti hai. Bina iske kuch upload nahi hota.

5. 2-3 minute rukein, phir apni site par **Ctrl+Shift+R** (ya phone par browser cache clear karke) refresh karein

---

## `.github` folder ke baare mein

Zip mein ek `.github` folder bhi hai. **Yeh optional hai.**

- Agar aapki repo → **Settings → Pages** mein Source **"Deploy from a branch"** set hai, toh `.github` ki bilkul zaroorat nahi — usse chhod dein
- Agar Source **"GitHub Actions"** set hai, tab yeh folder chahiye

Agar `.github` upload karne mein dikkat aa rahi hai, toh sabse aasaan raasta: **Settings → Pages → Source ko "Deploy from a branch" kar dein** aur `.github` bhool jaayein. Site phir bhi chalegi.

---

## Upload hone ke baad kaise pata chalega ki naya version hai?

Site par yeh 4 cheezein dikhni chahiye. Agar inme se koi bhi purani jaisi hai, matlab upload nahi hua:

| Naya version (sahi) | Purana version (galat) |
|---|---|
| Header mein **EN / हिं** button | Sirf 🌙 chand ka button |
| Nav mein **Community** link | Nav mein **Benefits** link |
| Building ki **photos** aur seal | Emoji 🪪 🔏 💳 aur koi logo nahi |
| Neeche **bottom tab bar** (Home/Notices/Pay/Account) | Kuch nahi |

---

## Agar phir bhi na chale

Repo → **Actions** tab kholein. Agar wahan lal ❌ dikhe, uspar click karke error dekhein aur mujhe bata dein. Agar wahan koi entry hi nahi hai, toh Settings → Pages mein Source check karein.
