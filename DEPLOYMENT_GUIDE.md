# Subdomain Deployment Guide for Hostinger VPS

## Prerequisites Checklist
- ✅ Nginx installed
- ✅ DNS wildcard record: `A * 0 72.60.220.22`
- ✅ React app built (`npm run build`)
- ⏳ SSL certificate for `*.yesgive.shop`
- ⏳ Nginx configuration

---

## Step 1: Install SSL Certificate (Wildcard)

SSH into your VPS:

```bash
ssh root@72.60.220.22
```

Install Certbot:

```bash
sudo apt update
sudo apt install certbot python3-certbot-nginx -y
```

Get wildcard SSL certificate:

```bash
sudo certbot certonly --manual --preferred-challenges dns -d yesgive.shop -d *.yesgive.shop
```

**Follow the prompts:**
1. Certbot will ask you to add a TXT record to your DNS
2. Go to Hostinger DNS settings
3. Add TXT record:
   - Type: `TXT`
   - Name: `_acme-challenge`
   - Value: (copy from Certbot output)
   - TTL: `300`
4. **Wait 5 minutes** for DNS propagation
5. Verify DNS updated: `nslookup -type=TXT _acme-challenge.yesgive.shop`
6. Press Enter in Certbot to continue

---

## Step 2: Upload Built Files to Server

### Option A: Using SCP (From Windows)

From your local machine (Git Bash or PowerShell):

```bash
# Navigate to project directory
cd /c/Users/Administrator/Desktop/vendy-buildr

# Create directory on server
ssh root@72.60.220.22 "mkdir -p /var/www/yesgive.shop"

# Upload dist folder
scp -r dist/* root@72.60.220.22:/var/www/yesgive.shop/
```

### Option B: Using FTP/SFTP (FileZilla)

1. Connect to: `sftp://72.60.220.22`
2. Upload `dist/*` to `/var/www/yesgive.shop/`

---

## Step 3: Configure Nginx

SSH into your server:

```bash
ssh root@72.60.220.22
```

Create Nginx configuration:

```bash
sudo nano /etc/nginx/sites-available/yesgive.shop
```

**Paste this configuration:**

```nginx
# Redirect HTTP to HTTPS
server {
    listen 80;
    listen [::]:80;
    server_name yesgive.shop *.yesgive.shop;
    return 301 https://$host$request_uri;
}

# Main HTTPS Server
server {
    listen 443 ssl http2;
    listen [::]:443 ssl http2;

    # Wildcard domain
    server_name yesgive.shop *.yesgive.shop;

    # SSL Certificate
    ssl_certificate /etc/letsencrypt/live/yesgive.shop/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/yesgive.shop/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;

    # App directory
    root /var/www/yesgive.shop;
    index index.html;

    # Logs
    access_log /var/log/nginx/yesgive.shop-access.log;
    error_log /var/log/nginx/yesgive.shop-error.log;

    # Compression
    gzip on;
    gzip_types text/plain text/css application/json application/javascript text/xml application/xml text/javascript;

    # Static assets with caching
    location ~* \.(js|css|png|jpg|jpeg|gif|ico|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # SPA fallback - CRITICAL FOR REACT ROUTER
    location / {
        try_files $uri $uri/ /index.html;
        add_header Cache-Control "no-cache, no-store, must-revalidate";
    }

    # Security headers
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;
}
```

**Save and exit:** `Ctrl+X`, then `Y`, then `Enter`

Enable the site:

```bash
# Create symbolic link
sudo ln -s /etc/nginx/sites-available/yesgive.shop /etc/nginx/sites-enabled/

# Remove default site if exists
sudo rm /etc/nginx/sites-enabled/default
```

---

## Step 4: Test and Reload Nginx

Test configuration:

```bash
sudo nginx -t
```

**Expected output:**
```
nginx: configuration file /etc/nginx/nginx.conf test is successful
```

If test passes, reload Nginx:

```bash
sudo systemctl reload nginx
```

Check Nginx status:

```bash
sudo systemctl status nginx
```

---

## Step 5: Test Your Subdomains

### Main Platform:
- Visit: `https://yesgive.shop`
- Should see: Landing page
- Test routes: `/pricing`, `/auth`, `/admin/dashboard`

### Store Subdomain:
- Visit: `https://sasumasale.yesgive.shop`
- Should see: Sasumasale store homepage
- Test routes: `/products`, `/cart`, `/checkout`

### Check Browser Console:
Open DevTools (F12) and look for:
```
Domain Info: { type: 'subdomain', subdomain: 'sasumasale', isStoreSpecific: true }
Store Identifier: sasumasale
```

---

## Troubleshooting

### Issue: 404 errors on any route

**Fix:** Check Nginx configuration has this line:
```nginx
location / {
    try_files $uri $uri/ /index.html;
}
```

Then reload:
```bash
sudo nginx -t
sudo systemctl reload nginx
```

### Issue: SSL certificate error

**Fix:** Verify certificate paths:
```bash
ls -la /etc/letsencrypt/live/yesgive.shop/
```

Should show: `fullchain.pem` and `privkey.pem`

### Issue: Subdomain shows "Connection refused"

**Fix:** Check DNS propagation:
```bash
nslookup sasumasale.yesgive.shop
```

Should resolve to: `72.60.220.22`

### Issue: CSS/JS files not loading

**Fix:** Check file permissions:
```bash
sudo chown -R www-data:www-data /var/www/yesgive.shop
sudo chmod -R 755 /var/www/yesgive.shop
```

---

## Auto-Renewal for SSL Certificate

Certbot auto-renewal is usually set up automatically, but verify:

```bash
# Test renewal
sudo certbot renew --dry-run

# Check renewal timer
sudo systemctl status certbot.timer
```

---

## Future Deployments

After making code changes:

```bash
# 1. Build locally
npm run build

# 2. Upload to server
scp -r dist/* root@72.60.220.22:/var/www/yesgive.shop/

# 3. Clear Nginx cache (optional)
sudo systemctl reload nginx
```

---

## Quick Reference Commands

```bash
# Check Nginx status
sudo systemctl status nginx

# Test Nginx config
sudo nginx -t

# Reload Nginx
sudo systemctl reload nginx

# Restart Nginx
sudo systemctl restart nginx

# View Nginx error logs
sudo tail -f /var/log/nginx/yesgive.shop-error.log

# View Nginx access logs
sudo tail -f /var/log/nginx/yesgive.shop-access.log
```

---

## Success Checklist

- [ ] SSL certificate installed for `*.yesgive.shop`
- [ ] Files uploaded to `/var/www/yesgive.shop/`
- [ ] Nginx configuration created and enabled
- [ ] Nginx test passed (`nginx -t`)
- [ ] Nginx reloaded successfully
- [ ] Main domain works: `https://yesgive.shop`
- [ ] Subdomain works: `https://sasumasale.yesgive.shop`
- [ ] All routes work (no 404 errors)
- [ ] Browser console shows correct domain detection

---

**Need Help?** Check logs:
```bash
sudo tail -50 /var/log/nginx/error.log
```
