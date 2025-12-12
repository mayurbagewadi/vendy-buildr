#!/bin/bash
set -e

echo "🚀 Deploying Digital Dukandar..."

cd /var/www/digitaldukandar

# Pull latest
git pull origin production

# Install and fix permissions
npm install
chmod -R +x node_modules/.bin

# Build using npx (handles permissions better)
npx vite build

# Reload nginx
sudo systemctl reload nginx

echo "✅ Deployed successfully!"
