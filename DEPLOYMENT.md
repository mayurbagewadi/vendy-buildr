# Deployment Guide - Hostinger VPS

This guide will help you set up CI/CD deployment from GitHub to your Hostinger VPS server.

## Prerequisites

- GitHub repository with production branch
- Hostinger VPS server (72.60.220.22)
- Root SSH access to the server
- Domain name (optional, can use IP initially)

## Server Structure for Multiple Projects

```
/var/www/
├── vendy-buildr/          # This project
│   ├── dist/              # Built files
│   └── deploy.sh          # Deployment script
├── project-2/             # Future project
│   ├── dist/
│   └── deploy.sh
└── project-3/             # Future project
    ├── dist/
    └── deploy.sh
```

## Setup Steps

### 1. Prepare Your Hostinger VPS Server

SSH into your server:
```bash
ssh root@72.60.220.22
```

#### Install Required Software

```bash
# Update system
apt update && apt upgrade -y

# Install Node.js 18.x
curl -fsSL https://deb.nodesource.com/setup_18.x | bash -
apt install -y nodejs

# Install Nginx
apt install -y nginx

# Install PM2 (optional, for Node.js apps)
npm install -g pm2

# Verify installations
node --version
npm --version
nginx -v
```

#### Create Project Directory

```bash
# Create directory for this project
mkdir -p /var/www/vendy-buildr
cd /var/www/vendy-buildr

# Create dist directory
mkdir -p dist

# Set proper ownership
chown -R www-data:www-data /var/www/vendy-buildr

# Create log directory
mkdir -p /var/log/nginx/vendy-buildr
```

### 2. Generate SSH Key for GitHub Actions

On your **local machine** (not the server), generate an SSH key pair:

```bash
# Generate SSH key (do this on your local machine)
ssh-keygen -t ed25519 -C "github-actions-vendy-buildr" -f github-actions-key
```

This creates two files:
- `github-actions-key` (private key) - for GitHub Secrets
- `github-actions-key.pub` (public key) - for VPS server

#### Add Public Key to VPS Server

Copy the content of `github-actions-key.pub` and add it to your server:

```bash
# On your VPS server
ssh root@72.60.220.22

# Add the public key to authorized_keys
mkdir -p ~/.ssh
chmod 700 ~/.ssh
nano ~/.ssh/authorized_keys

# Paste the content of github-actions-key.pub
# Save and exit (Ctrl+X, Y, Enter)

# Set correct permissions
chmod 600 ~/.ssh/authorized_keys
```

### 3. Configure GitHub Repository Secrets

Go to your GitHub repository → Settings → Secrets and variables → Actions → New repository secret

Add these secrets:

1. **VPS_HOST**
   - Value: `72.60.220.22`

2. **VPS_USERNAME**
   - Value: `root`

3. **VPS_SSH_KEY**
   - Value: Copy the **entire content** of `github-actions-key` (private key)
   ```
   -----BEGIN OPENSSH PRIVATE KEY-----
   (entire key content)
   -----END OPENSSH PRIVATE KEY-----
   ```

### 4. Configure Nginx for This Project

On your VPS server, edit the Nginx configuration:

```bash
nano /etc/nginx/sites-available/vendy-buildr
```

Add this configuration (will be auto-created by deploy.sh, but you can customize):

```nginx
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;  # Change this to your domain

    root /var/www/vendy-buildr/dist;
    index index.html;

    access_log /var/log/nginx/vendy-buildr/access.log;
    error_log /var/log/nginx/vendy-buildr/error.log;

    location / {
        try_files $uri $uri/ /index.html;
    }

    # Cache static assets
    location ~* \.(jpg|jpeg|png|gif|ico|css|js|svg|woff|woff2|ttf|eot)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    # Gzip compression
    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/x-javascript application/xml+rss application/javascript application/json;
}
```

Enable the site:

```bash
# Create symbolic link
ln -s /etc/nginx/sites-available/vendy-buildr /etc/nginx/sites-enabled/

# Test configuration
nginx -t

# Reload Nginx
systemctl reload nginx
```

### 5. Configure Firewall (UFW)

```bash
# Allow SSH (IMPORTANT: Do this first!)
ufw allow 22/tcp

# Allow HTTP and HTTPS
ufw allow 80/tcp
ufw allow 443/tcp

# Enable firewall
ufw enable

# Check status
ufw status
```

### 6. Initial Manual Deployment (First Time Only)

```bash
# On your VPS server
cd /var/www/vendy-buildr

# Create the deploy.sh script manually or wait for first GitHub Actions run
# Make it executable
chmod +x deploy.sh
```

## How It Works

### Automatic Deployment Process

1. **Developer pushes to `production` branch**
2. **GitHub Actions triggers automatically**
3. **Build process runs:**
   - Checks out code
   - Installs dependencies
   - Builds the project (`npm run build`)
4. **Files are transferred to VPS:**
   - dist/ folder
   - package.json
   - package-lock.json
5. **Deployment script runs on server:**
   - Sets proper permissions
   - Configures Nginx (if needed)
   - Reloads Nginx

### Manual Deployment

To manually trigger a deployment:

```bash
# Push to production branch
git checkout production
git merge main
git push origin production
```

Or trigger manually from GitHub Actions tab.

## Adding More Projects in the Future

For each new project:

1. **Create project directory on server:**
   ```bash
   mkdir -p /var/www/project-name
   ```

2. **Create new GitHub Actions workflow:**
   - Copy `.github/workflows/deploy-production.yml`
   - Rename and modify paths

3. **Create Nginx configuration:**
   - Copy nginx config
   - Change server_name and root path

4. **Use same SSH keys** (or generate new ones per project)

## Monitoring and Logs

### View deployment logs
```bash
# On GitHub: Actions tab → Select workflow run

# On server: Nginx logs
tail -f /var/log/nginx/vendy-buildr/access.log
tail -f /var/log/nginx/vendy-buildr/error.log
```

### Check Nginx status
```bash
systemctl status nginx
```

### Reload Nginx manually
```bash
systemctl reload nginx
```

## SSL Certificate (Optional but Recommended)

Install Let's Encrypt SSL:

```bash
# Install Certbot
apt install -y certbot python3-certbot-nginx

# Get SSL certificate (replace with your domain)
certbot --nginx -d your-domain.com -d www.your-domain.com

# Certbot will automatically configure Nginx for HTTPS
```

## Troubleshooting

### Deployment fails
1. Check GitHub Actions logs
2. Verify SSH connection: `ssh root@72.60.220.22`
3. Check file permissions on server

### Site not loading
1. Check Nginx: `systemctl status nginx`
2. Test config: `nginx -t`
3. Check logs: `tail -f /var/log/nginx/vendy-buildr/error.log`

### Permission errors
```bash
chown -R www-data:www-data /var/www/vendy-buildr/dist
chmod -R 755 /var/www/vendy-buildr/dist
```

## Security Best Practices

1. **Use SSH keys** (not passwords) ✓
2. **Disable root password login**
3. **Install fail2ban:** `apt install fail2ban`
4. **Keep system updated:** `apt update && apt upgrade`
5. **Use HTTPS/SSL certificates**
6. **Regular backups**

## Support

For issues with:
- **GitHub Actions**: Check repository Actions tab
- **Server**: Check Nginx logs
- **DNS/Domain**: Check Hostinger control panel
