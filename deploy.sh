#!/bin/bash

# Deployment script for Digital Dukandar (Static React App)
# This script builds and deploys the Vite React app to nginx

set -e  # Exit on error

echo "🚀 Starting deployment for Digital Dukandar..."

# Configuration
PROJECT_DIR="/var/www/digitaldukandar"
BRANCH="production"

# Colors for output
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m' # No Color

# Step 1: Stop PM2 if running (not needed for static apps)
echo -e "${YELLOW}⏹️  Stopping PM2 process if exists...${NC}"
if pm2 describe digitaldukandar > /dev/null 2>&1; then
    pm2 stop digitaldukandar || true
    pm2 delete digitaldukandar || true
    pm2 save --force
    echo -e "${GREEN}✅ PM2 process stopped and removed${NC}"
else
    echo -e "${GREEN}✅ No PM2 process found (expected for static app)${NC}"
fi

# Step 2: Navigate to project directory
echo -e "${YELLOW}📁 Navigating to project directory...${NC}"
cd "$PROJECT_DIR"

# Step 3: Pull latest code
echo -e "${YELLOW}⬇️  Pulling latest code from ${BRANCH} branch...${NC}"
git fetch origin
git checkout "$BRANCH"
git pull origin "$BRANCH"
echo -e "${GREEN}✅ Code updated${NC}"

# Step 4: Clean and install dependencies
echo -e "${YELLOW}📦 Cleaning and installing dependencies...${NC}"
rm -rf node_modules package-lock.json
npm install --legacy-peer-deps
echo -e "${GREEN}✅ Dependencies installed${NC}"

# Step 4.5: Fix permissions on node_modules
echo -e "${YELLOW}🔐 Fixing node_modules permissions...${NC}"
chmod -R 755 node_modules
echo -e "${GREEN}✅ Permissions fixed${NC}"

# Step 5: Build the application
echo -e "${YELLOW}🔨 Building application...${NC}"
npm run build
echo -e "${GREEN}✅ Build completed${NC}"

# Step 6: Verify dist folder
if [ ! -d "dist" ]; then
    echo -e "${RED}❌ Error: dist folder not found after build${NC}"
    exit 1
fi
echo -e "${GREEN}✅ Dist folder verified${NC}"

# Step 7: Set correct permissions
echo -e "${YELLOW}🔐 Setting correct permissions...${NC}"
chown -R www-data:www-data "$PROJECT_DIR/dist"
chmod -R 755 "$PROJECT_DIR/dist"
echo -e "${GREEN}✅ Permissions set${NC}"

# Step 8: Test nginx configuration
echo -e "${YELLOW}🔍 Testing nginx configuration...${NC}"
nginx -t
echo -e "${GREEN}✅ Nginx configuration valid${NC}"

# Step 9: Reload nginx
echo -e "${YELLOW}🔄 Reloading nginx...${NC}"
systemctl reload nginx
echo -e "${GREEN}✅ Nginx reloaded${NC}"

# Step 10: Deployment complete
echo -e "${GREEN}🎉 Deployment completed successfully!${NC}"
echo -e "${GREEN}📍 Site available at: https://digitaldukandar.in${NC}"

# Show disk usage
echo -e "${YELLOW}💾 Disk usage:${NC}"
du -sh "$PROJECT_DIR/dist"
