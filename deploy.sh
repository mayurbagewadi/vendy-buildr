#!/bin/bash
set -e

echo "🚀 Deploying Digital Dukandar..."

cd /var/www/digitaldukandar

# Pull latest
git pull origin production

# Build
npm install
npm run build

# Reload nginx
sudo systemctl reload nginx

echo "✅ Deployed successfully!"
