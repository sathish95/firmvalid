# Deploy Steps — Firmware Validator
Everything is 100% free. No credit card needed anywhere.

---

## STEP 1 — Get Free Gemini API Key (2 min)
1. Open https://aistudio.google.com
2. Sign in with Google
3. Click "Get API Key" → "Create API key"
4. Copy the key (looks like: AIzaSy...)
5. Save it somewhere — you'll need it in Step 3

---

## STEP 2 — Get Free Neon Database (2 min)
1. Open https://neon.tech
2. Click "Sign Up" → use GitHub login (no card needed)
3. Click "New Project" → name it: firmware-validator → Create
4. On the dashboard click "Connection Details"
5. Copy the Connection String (looks like):
   postgres://alex:pwd@ep-cool-fog.us-east-2.aws.neon.tech/neondb?sslmode=require
6. Save it — you'll need it in Step 3

---

## STEP 3 — Push Code to GitHub (3 min)
Open your terminal in this project folder and run:

  git init
  git add .
  git commit -m "initial commit"

Then create a repo on https://github.com/new
  - Name: firmware-validator
  - Visibility: Private or Public
  - Do NOT add README or .gitignore (already have them)
  - Click "Create repository"

GitHub will show commands. Run the ones like:
  git remote add origin https://github.com/YOURNAME/firmware-validator.git
  git branch -M main
  git push -u origin main

---

## STEP 4 — Deploy on Vercel (3 min)
1. Open https://vercel.com → Sign Up with GitHub
2. Click "Add New Project"
3. Find and Import your "firmware-validator" repo
4. Framework Preset: Vite (auto-detected)
5. Click "Environment Variables" and add TWO vars:

   Name:  GEMINI_API_KEY
   Value: AIzaSy... (your key from Step 1)

   Name:  DATABASE_URL
   Value: postgres://... (your string from Step 2)

6. Click "Deploy"
7. Wait ~60 seconds → your app is LIVE at:
   https://firmware-validator-XXXX.vercel.app

---

## DONE! Every git push auto-deploys.

## How to use the app:
- Paste any React/JSX firmware code into the editor
- Click "RUN VALIDATION"
- See Health Score (0-100) + KPIs + all issues with fix suggestions
- Use "Git Sync" tab to pull code directly from any GitHub repo
- "History" tab shows all past validations

## Score Guide:
  80-100  ✅ Healthy — safe to merge
  55-79   ⚠️  Needs review before merge
  0-54    🔴 High risk — fix issues first
