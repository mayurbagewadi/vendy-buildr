# VPS Direct Upload Setup

## Step 1: Upload PHP Script to VPS

SSH into your VPS:
```bash
ssh root@147.79.70.113
```

Create API directory:
```bash
mkdir -p /var/www/digitaldukandar.in/api
```

Create upload.php file:
```bash
nano /var/www/digitaldukandar.in/api/upload.php
```

**Paste the content from `vps-upload-endpoint.php`** (copy entire file content)

Save and exit (Ctrl+O, Enter, Ctrl+X)

Set permissions:
```bash
chmod 755 /var/www/digitaldukandar.in/api
chmod 644 /var/www/digitaldukandar.in/api/upload.php
chown -R www-data:www-data /var/www/digitaldukandar.in/api
```

---

## Step 2: Configure Nginx

Edit Nginx config:
```bash
nano /etc/nginx/sites-available/digitaldukandar.in
```

Add this inside the `server {}` block:
```nginx
# API endpoint for direct uploads
location /api/ {
    alias /var/www/digitaldukandar.in/api/;

    # PHP handler
    location ~ \.php$ {
        fastcgi_pass unix:/var/run/php/php8.1-fpm.sock;  # Adjust PHP version if needed
        fastcgi_index index.php;
        fastcgi_param SCRIPT_FILENAME $request_filename;
        include fastcgi_params;
    }

    # Increase upload size limit
    client_max_body_size 10M;
}
```

Test and reload:
```bash
nginx -t
systemctl reload nginx
```

---

## Step 3: Test Upload Endpoint

From your local machine:
```bash
curl -X POST https://digitaldukandar.in/api/upload.php \
  -F "file=@/path/to/test-image.jpg" \
  -F "type=products"
```

Should return:
```json
{
  "success": true,
  "imageUrl": "https://digitaldukandar.in/uploads/products/abc-123.jpg",
  "fileId": "abc-123.jpg",
  "fileSizeMB": 2.36,
  "fileType": "products"
}
```

---

## Notes:
- No authentication (public endpoint)
- 5MB file size limit enforced
- Only accepts image files
- Auto-creates subdirectories
- Returns same format as edge function for compatibility
