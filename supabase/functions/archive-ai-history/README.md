# AI History Archive to Google Drive

**Automatically archives AI designer history older than 30 days to Google Drive and deletes from Supabase.**

## 🎯 What It Does

- **Daily Job:** Runs every day at 2 AM
- **Finds:** AI history records older than 30 days
- **Archives:** Uploads to Google Drive as JSONL files
- **Deletes:** Removes from Supabase after successful upload
- **Result:** Database always has exactly last 30 days, unlimited storage in Google Drive

---

## 📋 Setup Steps

### 1. Create Google Drive Service Account

1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create new project or select existing
3. Enable **Google Drive API**
4. Create **Service Account**:
   - IAM & Admin → Service Accounts → Create Service Account
   - Name: `vendy-buildr-archive`
   - Role: None needed (will use folder sharing)
5. Create **JSON Key**:
   - Click on service account
   - Keys → Add Key → Create New Key → JSON
   - Download `service-account-key.json`

### 2. Create Google Drive Folder

1. Go to [Google Drive](https://drive.google.com/)
2. Create folder: `Vendy-Buildr AI History`
3. Right-click → Share
4. Add service account email (from JSON key: `client_email`)
5. Set permission: **Editor**
6. Copy **Folder ID** from URL:
   - URL: `https://drive.google.com/drive/folders/1a2b3c4d5e6f7g8h9i0j`
   - Folder ID: `1a2b3c4d5e6f7g8h9i0j`

### 3. Add Credentials to Platform Settings

1. Run migration: `supabase db push`
2. Go to **SuperAdmin → Platform Settings**
3. Add fields:
   - **Google Drive Service Account JSON**: Paste entire content of `service-account-key.json`
   - **Google Drive Archive Folder ID**: Paste folder ID from step 2
4. Save

### 4. Deploy Edge Function

```bash
supabase functions deploy archive-ai-history
```

### 5. Set Up Daily Cron Job

**Get your Supabase details:**
- Project Ref: Found in project URL (e.g., `vexeuxsvckpfvuxqchqu`)
- Service Role Key: Settings → API → `service_role` key

**Run this SQL in Supabase SQL Editor** (replace placeholders):

```sql
-- Schedule daily archive job at 2 AM UTC
SELECT cron.schedule(
  'daily-ai-history-archive',
  '0 2 * * *',
  $$
  SELECT net.http_post(
    url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/archive-ai-history',
    headers := jsonb_build_object(
      'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
      'Content-Type', 'application/json'
    ),
    body := jsonb_build_object('action', 'daily_archive')
  ) as request_id;
  $$
);
```

**Verify it's scheduled:**
```sql
SELECT * FROM cron.job WHERE jobname = 'daily-ai-history-archive';
```

### 6. Test Manually (Optional)

**Replace placeholders with your actual values:**

```sql
-- Test archive manually
SELECT net.http_post(
  url := 'https://YOUR_PROJECT_REF.supabase.co/functions/v1/archive-ai-history',
  headers := jsonb_build_object(
    'Authorization', 'Bearer YOUR_SERVICE_ROLE_KEY',
    'Content-Type', 'application/json'
  ),
  body := jsonb_build_object('action', 'daily_archive')
) as request_id;
```

**Check the result:**
```sql
-- View request status (use request_id from above)
SELECT * FROM net._http_response WHERE id = 'REQUEST_ID_HERE';
```

---

## 📊 How It Works

### Daily Flow:

```
2:00 AM Daily
    ↓
Find records > 30 days old
    ↓
Group by date
    ↓
For each date:
  ├─ Create JSONL file
  ├─ Upload to Google Drive
  ├─ Save metadata to ai_history_archives
  └─ Delete from ai_designer_history
    ↓
Complete ✅
```

### Google Drive File Structure:

```
Vendy-Buildr AI History/
  ├─ ai-history-2026-01-15.jsonl
  ├─ ai-history-2026-01-16.jsonl
  ├─ ai-history-2026-01-17.jsonl
  └─ ...
```

### JSONL File Format:

Each line is one JSON record:
```jsonl
{"id":"uuid1","store_id":"uuid","prompt":"Make it purple","ai_response":{...},"created_at":"2026-01-15T10:00:00Z"}
{"id":"uuid2","store_id":"uuid","prompt":"Add rounded buttons","ai_response":{...},"created_at":"2026-01-15T14:30:00Z"}
```

---

## 🔍 Monitor Archives

### View Archive Metadata:

```sql
SELECT
  archive_date,
  record_count,
  file_size_bytes / 1024 / 1024 AS size_mb,
  google_drive_file_url,
  archived_at
FROM ai_history_archives
ORDER BY archive_date DESC
LIMIT 20;
```

### Check Current Database Size:

```sql
SELECT
  COUNT(*) as total_records,
  MIN(created_at) as oldest_record,
  MAX(created_at) as newest_record,
  EXTRACT(DAY FROM MAX(created_at) - MIN(created_at)) as days_span
FROM ai_designer_history;
```

Should show approximately 30 days worth of records.

---

## 🛠️ Troubleshooting

### Cron Job Not Running?

Check logs:
```sql
SELECT * FROM cron.job_run_details
WHERE jobname = 'daily-ai-history-archive'
ORDER BY start_time DESC
LIMIT 10;
```

### Google Drive Upload Failing?

1. Verify service account has Editor access to folder
2. Check credentials in platform_settings
3. Verify Google Drive API is enabled in Google Cloud Console
4. Check edge function logs in Supabase Dashboard

### Records Not Deleting?

- Archive only deletes records AFTER successful Google Drive upload
- If upload fails, records stay in Supabase (safe)
- Check `ai_history_archives` table to see what was successfully archived

---

## ⚠️ Important Notes

- **Safe by Design:** Records deleted ONLY after successful Google Drive upload
- **Gradual Cleanup:** Archives one day at a time, not batch
- **Always 30 Days:** Database maintains rolling 30-day window
- **Unlimited Storage:** Google Drive free tier is 15 GB (expandable)
- **Searchable:** JSONL format is grep-friendly for searching archives

---

## 📈 Storage Savings

**Before:**
- 10,000 prompts/month = 50-100 MB
- 1 year = 1.2 GB in Supabase ❌

**After:**
- Last 30 days = 5-10 MB in Supabase ✅
- Older data = 600 MB/year in Google Drive ✅
- **95% Supabase storage savings** 🎉
