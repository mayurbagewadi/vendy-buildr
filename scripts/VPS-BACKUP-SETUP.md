# VPS Backup Setup Instructions

## Overview
This guide will help you set up automatic database backups on your Hostinger VPS.

**Backup Schedule:**
- Runs every 6 hours (4 times per day)
- Keeps backups for 30 days
- Auto-deletes old backups

---

## Step 1: Get Your Supabase Database URL

1. Go to https://supabase.com/dashboard
2. Select your project
3. Go to **Settings** → **Database**
4. Scroll to **Connection String**
5. Click **URI** tab
6. Copy the connection string (looks like):
   ```
   postgresql://postgres:[YOUR-PASSWORD]@db.xxxxx.supabase.co:5432/postgres
   ```
7. **IMPORTANT:** Replace `[YOUR-PASSWORD]` with your actual database password

---

## Step 2: Upload Script to VPS

### Option A: Using SSH (Recommended)

1. **Connect to your VPS:**
   ```bash
   ssh your-username@your-vps-ip
   ```

2. **Create backup directory:**
   ```bash
   mkdir -p /home/backups/database
   mkdir -p /home/backups
   ```

3. **Create the backup script:**
   ```bash
   nano /home/backups/vps-backup.sh
   ```

4. **Copy the script content** from `scripts/vps-backup.sh` and paste it

5. **Edit the database URL:**
   - Find the line: `DB_URL="postgresql://postgres:YOUR_PASSWORD@..."`
   - Replace with your actual Supabase database URL from Step 1

6. **Save and exit:**
   - Press `Ctrl + X`
   - Press `Y`
   - Press `Enter`

### Option B: Using FTP/File Manager

1. Upload `vps-backup.sh` to `/home/backups/` using Hostinger File Manager
2. Edit the file and replace `DB_URL` with your actual database URL

---

## Step 3: Make Script Executable

```bash
chmod +x /home/backups/vps-backup.sh
```

---

## Step 4: Test the Backup (IMPORTANT!)

Run the backup script manually to make sure it works:

```bash
/home/backups/vps-backup.sh
```

**Expected output:**
```
[2025-12-23 10:00:00] Starting database backup...
[2025-12-23 10:00:05] Creating backup: /home/backups/database/backup_20251223_100005.sql
[2025-12-23 10:00:15] ✓ Backup created successfully
[2025-12-23 10:00:16] Compressing backup...
[2025-12-23 10:00:17] ✓ Backup compressed: backup_20251223_100005.sql.gz (2.3M)
[2025-12-23 10:00:17] Backup completed successfully!
```

**If you see errors:**
- Check if PostgreSQL client is installed
- Verify database URL is correct
- Check VPS has internet access

---

## Step 5: Set Up Automatic Backups (Cron Job)

### Create Cron Job to Run Every 6 Hours:

1. **Open crontab:**
   ```bash
   crontab -e
   ```

2. **Add this line at the end:**
   ```
   0 */6 * * * /home/backups/vps-backup.sh >> /home/backups/cron.log 2>&1
   ```

   **Explanation:**
   - `0 */6 * * *` = Run at minute 0 of every 6th hour (12am, 6am, 12pm, 6pm)
   - `/home/backups/vps-backup.sh` = Your backup script
   - `>> /home/backups/cron.log 2>&1` = Log output to file

3. **Save and exit:**
   - Press `Ctrl + X`
   - Press `Y`
   - Press `Enter`

4. **Verify cron job is active:**
   ```bash
   crontab -l
   ```

---

## Step 6: Monitor Backups

### Check if backups are being created:
```bash
ls -lh /home/backups/database/
```

### View backup log:
```bash
tail -f /home/backups/backup.log
```

### Check disk space:
```bash
df -h
du -sh /home/backups/database/
```

---

## How to Restore a Backup

### If you need to restore your database:

1. **List available backups:**
   ```bash
   ls -lh /home/backups/database/
   ```

2. **Choose a backup file** (example: `backup_20251223_100005.sql.gz`)

3. **Decompress the backup:**
   ```bash
   gunzip /home/backups/database/backup_20251223_100005.sql.gz
   ```

4. **Restore to Supabase:**
   ```bash
   psql "postgresql://postgres:YOUR_PASSWORD@db.xxxxx.supabase.co:5432/postgres" \
     < /home/backups/database/backup_20251223_100005.sql
   ```

5. **IMPORTANT:** This will **overwrite** your current database with the backup!

---

## Troubleshooting

### PostgreSQL client not installed?
```bash
# Ubuntu/Debian
sudo apt-get update
sudo apt-get install -y postgresql-client

# CentOS/AlmaLinux
sudo yum install -y postgresql
```

### Check if cron is running:
```bash
sudo systemctl status cron
```

### View cron logs:
```bash
tail -f /home/backups/cron.log
```

### Permission denied errors:
```bash
chmod +x /home/backups/vps-backup.sh
chown $USER:$USER /home/backups/vps-backup.sh
```

---

## Backup Schedule Summary

| Time    | Backup Created |
|---------|----------------|
| 12:00 AM | ✓ |
| 6:00 AM  | ✓ |
| 12:00 PM | ✓ |
| 6:00 PM  | ✓ |

**Total:** 4 backups per day
**Retention:** 30 days
**Total files:** ~120 backup files

---

## Security Notes

⚠️ **IMPORTANT:**
- Never share your database URL publicly
- Keep VPS SSH access secure
- Backup files contain ALL your data (keep VPS secure)
- Consider encrypting backups for extra security

---

## Next Steps

After setup is complete:
1. ✅ Wait 6 hours and check if first automatic backup was created
2. ✅ Monitor logs for any errors
3. ✅ Test restore process once to make sure it works

**Questions? Issues?** Check the troubleshooting section above.
