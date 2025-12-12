#!/bin/bash

# Deployment script for Hostinger VPS - digitaldukandar.in

set -e

echo "🚀 Starting deployment for digitaldukandar.in..."

# Navigate to project directory
cd /var/www/digitaldukandar

# Pull latest code
echo "📥 Pulling latest code from GitHub..."
git pull origin main

# Install dependencies
echo "📦 Installing dependencies..."
npm install

# Build the project
echo "🔨 Building project..."
npm run build

# Restart PM2 process
echo "🔄 Restarting application..."
pm2 restart digitaldukandar || pm2 start npm --name "digitaldukandar" -- start

echo "✅ Deployment completed successfully!"
