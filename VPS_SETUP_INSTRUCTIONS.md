# VPS Setup Instructions for Image Upload

This document provides step-by-step instructions to set up your VPS server (Hostinger) for image uploads.

---

## Prerequisites
- SSH access to your VPS
- Root or sudo privileges
- Nginx already installed and running

---

## Step 1: Create Upload Directories

SSH into your VPS and run the following commands:

```bash
# Create upload directories
sudo mkdir -p /var/www/digitaldukandar.in/uploads/products
sudo mkdir -p /var/www/digitaldukandar.in/uploads/categories
sudo mkdir -p /var/www/digitaldukandar.in/uploads/banners

# Set proper permissions
sudo chmod 755 -R /var/www/digitaldukandar.in/uploads

# Set ownership to web server user (usually www-data or nginx)
sudo chown -R www-data:www-data /var/www/digitaldukandar.in/uploads
# OR if using nginx user:
# sudo chown -R nginx:nginx /var/www/digitaldukandar.in/uploads
```

---

## Step 2: Configure Nginx

### 2.1 Open Nginx Configuration

```bash
sudo nano /etc/nginx/sites-available/digitaldukandar.in
```

### 2.2 Add Upload Location Block

Add this location block inside your `server {}` block:

```nginx
server {
    # ... existing configuration ...

    # Serve uploaded images
    location /uploads/ {
        alias /var/www/digitaldukandar.in/uploads/;
        expires 30d;
        add_header Cache-Control "public, immutable";
        access_log off;

        # Security headers
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Frame-Options "DENY" always;

        # Only allow image files
        location ~ \.(jpg|jpeg|png|gif|webp)$ {
            try_files $uri =404;
        }
    }

    # ... rest of configuration ...
}
```

### 2.3 Test and Reload Nginx

```bash
# Test configuration
sudo nginx -t

# If test passes, reload Nginx
sudo systemctl reload nginx
```

---

## Step 3: Configure Supabase Edge Function Secrets

Go to your Supabase Dashboard → Project Settings → Edge Functions → Secrets

Add the following secrets:

### Secret 1: VPS_HOST
```
Value: YOUR_VPS_IP_ADDRESS or digitaldukandar.in
Example: 72.60.220.22
```

### Secret 2: VPS_PORT
```
Value: 22
(SSH port, default is 22)
```

### Secret 3: VPS_USERNAME
```
Value: YOUR_SSH_USERNAME
Example: root or ubuntu or your custom user
```

### Secret 4: VPS_SSH_KEY
```
Value: YOUR_PRIVATE_SSH_KEY
```

**How to get your SSH private key:**

```bash
# On your local machine (not VPS), generate a new SSH key pair
ssh-keygen -t rsa -b 4096 -C "supabase-upload" -f ~/.ssh/supabase_upload_key

# This creates two files:
# - ~/.ssh/supabase_upload_key (private key) ← Copy this to Supabase
# - ~/.ssh/supabase_upload_key.pub (public key) ← Add to VPS

# View private key:
cat ~/.ssh/supabase_upload_key
# Copy the entire output including:
# -----BEGIN OPENSSH PRIVATE KEY-----
# ... key content ...
# -----END OPENSSH PRIVATE KEY-----
```

**Add public key to VPS:**

```bash
# SSH into your VPS
ssh your_username@digitaldukandar.in

# Add public key to authorized_keys
mkdir -p ~/.ssh
chmod 700 ~/.ssh

# Copy the public key content from your local machine:
cat ~/.ssh/supabase_upload_key.pub

# On VPS, paste it into authorized_keys:
echo "PASTE_YOUR_PUBLIC_KEY_HERE" >> ~/.ssh/authorized_keys

# Set proper permissions
chmod 600 ~/.ssh/authorized_keys
```

### Secret 5: VPS_UPLOAD_PATH
```
Value: /var/www/digitaldukandar.in/uploads/
```

---

## Step 4: Test Image Upload

### 4.1 Test from Command Line

```bash
# From your local machine, test SSH access:
ssh -i ~/.ssh/supabase_upload_key your_username@digitaldukandar.in

# Test SCP file transfer:
echo "test" > test.txt
scp -i ~/.ssh/supabase_upload_key test.txt your_username@digitaldukandar.in:/var/www/digitaldukandar.in/uploads/products/
```

### 4.2 Test Image Access

After uploading a test image, verify you can access it:

```
https://digitaldukandar.in/uploads/products/test.jpg
```

---

## Step 5: Deploy Edge Function

The `upload-to-vps` edge function needs to be deployed to Supabase.

### Option A: Using Supabase CLI

```bash
# Navigate to project directory
cd C:\Users\Administrator\Desktop\vendy-buildr

# Login to Supabase
supabase login

# Link to your project
supabase link --project-ref YOUR_PROJECT_REF

# Deploy the edge function
supabase functions deploy upload-to-vps
```

### Option B: Using GitHub Actions

Your existing `.github/workflows/deploy.yml` should automatically deploy edge functions when you push to production branch.

---

## Step 6: Verify Setup

### 6.1 Check Directory Structure

```bash
ls -la /var/www/digitaldukandar.in/uploads/
```

Should show:
```
drwxr-xr-x products
drwxr-xr-x categories
drwxr-xr-x banners
```

### 6.2 Check Nginx Configuration

```bash
sudo nginx -t
curl -I https://digitaldukandar.in/uploads/
```

### 6.3 Test Upload from Admin Panel

1. Login to admin panel
2. Go to Products → Add Product
3. Select "VPS Server" upload option
4. Upload an image
5. Check if it appears in the preview
6. Verify file exists on VPS:

```bash
ls -lh /var/www/digitaldukandar.in/uploads/products/
```

---

## Troubleshooting

### Issue 1: Permission Denied

```bash
# Fix ownership
sudo chown -R www-data:www-data /var/www/digitaldukandar.in/uploads

# Fix permissions
sudo chmod 755 -R /var/www/digitaldukandar.in/uploads
sudo chmod 644 /var/www/digitaldukandar.in/uploads/*/*.jpg
```

### Issue 2: 404 Not Found for Images

```bash
# Check Nginx error log
sudo tail -f /var/log/nginx/error.log

# Verify file exists
ls /var/www/digitaldukandar.in/uploads/products/

# Test Nginx config
sudo nginx -t
```

### Issue 3: SSH Connection Failed

```bash
# Test SSH key from local machine
ssh -i ~/.ssh/supabase_upload_key -v your_username@digitaldukandar.in

# Check SSH logs on VPS
sudo tail -f /var/log/auth.log
```

### Issue 4: SCP Upload Failed

```bash
# Verify write permissions
sudo -u www-data touch /var/www/digitaldukandar.in/uploads/products/test.txt

# Check if directory is writable
ls -ld /var/www/digitaldukandar.in/uploads/products/
```

---

## Security Best Practices

1. **Use SSH Key Authentication** - Never use password authentication for automated uploads
2. **Restrict SSH Key Access** - The SSH key should only have write access to upload directories
3. **Set Proper File Permissions** - 755 for directories, 644 for files
4. **Enable HTTPS** - All images should be served over HTTPS
5. **Monitor Disk Space** - Set up alerts when disk space is low

```bash
# Check disk space
df -h

# Set up disk space monitoring (optional)
sudo apt install ncdu
ncdu /var/www/digitaldukandar.in/uploads
```

---

## Backup Strategy

### Automated Backup Script

Create a backup script to save images:

```bash
#!/bin/bash
# File: /home/your_username/backup_uploads.sh

BACKUP_DIR="/home/your_username/backups"
UPLOAD_DIR="/var/www/digitaldukandar.in/uploads"
DATE=$(date +%Y-%m-%d)

# Create backup
tar -czf "$BACKUP_DIR/uploads-$DATE.tar.gz" "$UPLOAD_DIR"

# Remove backups older than 7 days
find "$BACKUP_DIR" -name "uploads-*.tar.gz" -mtime +7 -delete

echo "Backup completed: uploads-$DATE.tar.gz"
```

Make it executable and add to crontab:

```bash
chmod +x /home/your_username/backup_uploads.sh

# Add to crontab (run daily at 2 AM)
crontab -e
# Add this line:
0 2 * * * /home/your_username/backup_uploads.sh
```

---

## Maintenance

### Check Upload Stats

```bash
# Count files
find /var/www/digitaldukandar.in/uploads -type f | wc -l

# Total size
du -sh /var/www/digitaldukandar.in/uploads

# Size by type
du -sh /var/www/digitaldukandar.in/uploads/*
```

### Clean Old Test Files (if needed)

```bash
# Remove test files (be careful!)
find /var/www/digitaldukandar.in/uploads -name "test*" -type f -delete
```

---

## Support

If you encounter issues:

1. Check Edge Function logs in Supabase Dashboard
2. Check Nginx error logs: `sudo tail -f /var/log/nginx/error.log`
3. Check SSH logs: `sudo tail -f /var/log/auth.log`
4. Verify Supabase secrets are set correctly
5. Test SSH connection manually

---

## Summary Checklist

- [ ] Upload directories created with proper permissions
- [ ] Nginx configured to serve /uploads/
- [ ] Nginx tested and reloaded
- [ ] SSH key pair generated
- [ ] Public key added to VPS authorized_keys
- [ ] All 5 Supabase secrets configured
- [ ] Edge function deployed
- [ ] Test image upload successful
- [ ] Test image accessible via URL
- [ ] Backup strategy implemented (optional)

---

**Once all steps are complete, your VPS upload system is ready to use!**
