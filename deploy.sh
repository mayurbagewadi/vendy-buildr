#!/bin/bash
set -e

echo "🚀 Deploying Digital Dukandar..."

cd /var/www/digitaldukandar

# Pull latest code
echo "📥 Pulling latest code..."
git pull origin production

# Install dependencies and fix permissions
echo "📦 Installing dependencies..."
npm install
chmod -R +x node_modules/.bin

# Build application
echo "🔨 Building application..."
npx vite build

# Update nginx configuration
echo "⚙️  Updating nginx configuration..."
sudo cp nginx.conf /etc/nginx/sites-available/digitaldukandar

# Test nginx configuration before applying
echo "🧪 Testing nginx configuration..."
sudo nginx -t

# Reload nginx to apply changes
echo "🔄 Reloading nginx..."
sudo systemctl reload nginx

# Verify deployment
echo "✅ Deployment completed successfully!"
echo "🌐 Main site: https://digitaldukandar.in"
echo "📄 Sitemap: https://digitaldukandar.in/sitemap.xml"
