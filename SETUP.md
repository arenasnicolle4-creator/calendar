# CleanSync Pro — Setup & Deployment Guide

Follow these steps **in order**. Each step links to a free service.

---

## Step 1 — Get the code on GitHub

1. Go to https://github.com and create a free account (or log in)
2. Click **"New repository"** → name it `cleansync` → **Private** → Create
3. Upload all these files to the repo (drag and drop the whole folder)

---

## Step 2 — Set up a free database (Neon)

1. Go to https://neon.tech and sign up free
2. Create a new project called `cleansync`
3. Copy the **Connection string** — it looks like:
   `postgresql://user:password@ep-xxx.us-east-1.aws.neon.tech/neondb`
4. Save this — it's your `DATABASE_URL`

---

## Step 3 — Set up Google OAuth (so Gmail login works)

1. Go to https://console.cloud.google.com
2. Create a new project called `CleanSync`
3. Go to **APIs & Services → OAuth consent screen**
   - Choose **External**
   - Fill in app name: `CleanSync`
   - Add your email as a test user
4. Go to **APIs & Services → Credentials → Create Credentials → OAuth 2.0 Client ID**
   - Application type: **Web application**
   - Name: `CleanSync`
   - Authorized redirect URIs — add:
     `https://YOUR-APP.vercel.app/api/auth/gmail/callback`
     (you'll get this URL in Step 4 — come back and add it)
5. Copy **Client ID** and **Client Secret** — save these

6. Go to **APIs & Services → Library** → search **Gmail API** → Enable it

---

## Step 4 — Deploy to Vercel

1. Go to https://vercel.com and sign up with your GitHub account
2. Click **"Add New Project"** → import your `cleansync` repo
3. **Before deploying**, add these Environment Variables:

   | Variable | Value |
   |---|---|
   | `DATABASE_URL` | Your Neon connection string from Step 2 |
   | `GOOGLE_CLIENT_ID` | From Step 3 |
   | `GOOGLE_CLIENT_SECRET` | From Step 3 |
   | `NEXTAUTH_SECRET` | Any random 32-char string (generate at https://generate-secret.vercel.app/32) |
   | `NEXTAUTH_URL` | `https://YOUR-APP.vercel.app` (Vercel gives you this URL) |

4. Click **Deploy** — wait ~2 minutes

5. **Go back to Google Console** and add your real Vercel URL to the authorized redirect URIs:
   `https://your-actual-app.vercel.app/api/auth/gmail/callback`

---

## Step 5 — Initialize the database

After deploy, open your Vercel app URL, then run the database migration.

In Vercel dashboard → your project → **Settings → Functions → Console**, run:
```
npx prisma db push
```

Or you can do this locally if you have Node.js installed:
```bash
npm install
DATABASE_URL="your-neon-connection-string" npx prisma db push
```

---

## Step 6 — Connect your Gmail accounts

1. Open your CleanSync app at your Vercel URL
2. Click **✉ Gmail** button in the top header
3. Click **"+ Connect Gmail Account"**
4. Log in with `akcleaningsucasa@gmail.com` → Allow access
5. It will redirect back and start syncing automatically
6. Click **"+ Connect Gmail Account"** again for your second Gmail

That's it! CleanSync will now check both inboxes every 10 minutes for Turno job emails and add them to your calendar automatically.

---

## How the auto-sync works

- Vercel runs a **cron job every 10 minutes** that hits `/api/gmail/sync`
- It searches each connected Gmail for emails from `noreply@turno.com`
- New emails get parsed and added to the calendar automatically
- Duplicate emails are ignored (tracked by Gmail message ID)
- You can also hit **⟳ Sync Now** in the sidebar anytime

---

## Troubleshooting

**"No jobs appearing"**
→ Make sure the Gmail API is enabled in Google Console (Step 3, last part)
→ Try clicking Sync Now in the sidebar

**"OAuth error" when connecting Gmail**
→ Double-check the redirect URI in Google Console matches exactly

**"Database error"**
→ Make sure you ran `prisma db push` in Step 5

**Gmail says "App not verified"**
→ Click "Advanced" → "Go to CleanSync (unsafe)" — this is normal for personal apps
→ Or go to Google Console → OAuth consent screen → Publish the app
