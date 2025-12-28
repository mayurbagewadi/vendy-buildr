# Automated Sitemap Submission to Google

This automatically submits sitemaps for ALL your stores to Google Search Console with ZERO manual work!

## 🎯 Features

- ✅ Auto-submits main platform sitemap
- ✅ Auto-submits ALL store sitemaps (current + future)
- ✅ Runs automatically every week
- ✅ Can trigger manually anytime
- ✅ Handles subdomains and custom domains
- ✅ No manual intervention needed!

## 🚀 One-Time Setup (5 Minutes)

### Step 1: Create Google Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Create a new project (or use existing)
3. Enable **Google Search Console API**
4. Create **Service Account**:
   - Go to "IAM & Admin" → "Service Accounts"
   - Click "Create Service Account"
   - Name it: `sitemap-submitter`
   - Click "Create and Continue"
   - Skip permissions (click "Continue")
   - Click "Done"

5. **Create Key**:
   - Click on your new service account
   - Go to "Keys" tab
   - Click "Add Key" → "Create new key"
   - Choose **JSON**
   - Download the file → Save as `google-service-account.json`

### Step 2: Add Service Account to Search Console

1. Go to [Google Search Console](https://search.google.com/search-console)
2. Add your domain: `digitaldukandar.in`
3. Verify ownership (upload HTML file or DNS record)
4. Go to **Settings** → **Users and permissions**
5. Click **Add User**
6. Enter the service account email (from step 1, looks like `sitemap-submitter@PROJECT-ID.iam.gserviceaccount.com`)
7. Set permission to **Owner**
8. Click **Add**

### Step 3: Configure GitHub Secrets

1. Go to your GitHub repo → **Settings** → **Secrets and variables** → **Actions**
2. Add these secrets:

   - **GOOGLE_SERVICE_ACCOUNT_JSON**: Paste the entire contents of `google-service-account.json`
   - **VITE_SUPABASE_URL**: Your Supabase URL
   - **VITE_SUPABASE_PUBLISHABLE_KEY**: Your Supabase anon key

### Step 4: Done! 🎉

The automation is now set up! It will:
- Run automatically every Monday at 9 AM UTC
- Submit sitemaps for ALL stores (existing + new)
- No manual work required!

## 🔧 Manual Triggering

### Option 1: GitHub Actions (Web UI)
1. Go to your repo → **Actions** tab
2. Click **Submit Sitemaps to Google**
3. Click **Run workflow**
4. Click **Run workflow** (green button)

### Option 2: Command Line (Local)
```bash
# Install dependencies first (one time)
npm install googleapis @supabase/supabase-js

# Set environment variables
export GOOGLE_APPLICATION_CREDENTIALS="./google-service-account.json"
export VITE_SUPABASE_URL="your-supabase-url"
export VITE_SUPABASE_PUBLISHABLE_KEY="your-supabase-key"

# Run the script
node scripts/submit-sitemaps.js
```

### Option 3: npm script
```bash
npm run submit-sitemaps
```

## 🔄 How It Works

1. **Fetches all active stores** from your Supabase database
2. **Builds sitemap URLs** for each store:
   - Custom domains: `https://yourstore.com/sitemap.xml`
   - Subdomains: `https://storename.digitaldukandar.in/sitemap.xml`
   - Slugs: `https://digitaldukandar.in/storename/sitemap.xml`
3. **Submits to Google Search Console** using the API
4. **Logs results** - shows success/failures

## 📊 What Gets Submitted

- Main platform: `https://digitaldukandar.in/sitemap.xml`
- Store 1: `https://sasumasale.digitaldukandar.in/sitemap.xml`
- Store 2: `https://example.com/sitemap.xml` (if custom domain)
- Store 3+: All current and future stores automatically!

## ⏱️ When It Runs

- **Automatically**: Every Monday at 9 AM UTC (weekly)
- **On new store creation**: When you create a new store (via API trigger)
- **Manually**: Anytime you want via GitHub Actions or command line

## 🔒 Security

- Service account credentials stored as GitHub Secrets (encrypted)
- Credentials file deleted after each run
- Read-only access to Supabase (only fetches store data)

## ❓ Troubleshooting

**Error: "User does not have sufficient permissions"**
- Make sure you added the service account email to Search Console with Owner permissions

**Error: "Site not verified"**
- Verify your domain in Google Search Console first

**Script runs but nothing happens**
- Check that your stores have `is_active = true` in the database
- Verify Supabase credentials are correct

## 📝 Notes

- Google may take 24-48 hours to start indexing after sitemap submission
- The script has built-in rate limiting (1 request per second)
- Submitting the same sitemap multiple times is safe (Google handles duplicates)
- New stores will be auto-submitted on the next weekly run

## 🎉 Benefits

- ✅ No manual sitemap submission needed
- ✅ All stores get indexed automatically
- ✅ New stores auto-submitted
- ✅ Set it and forget it!
- ✅ Saves hours of manual work
