#!/bin/bash

# Deployment script for Vendy-Buildr on Hostinger VPS
# This script runs on the server after files are transferred

set -e  # Exit on any error

PROJECT_NAME="vendy-buildr"
PROJECT_DIR="/var/www/${PROJECT_NAME}"
NGINX_SITES_AVAILABLE="/etc/nginx/sites-available"
NGINX_SITES_ENABLED="/etc/nginx/sites-enabled"

echo "========================================="
echo "Deploying ${PROJECT_NAME} to production"
echo "========================================="

# Navigate to project directory
cd ${PROJECT_DIR}

# Create necessary directories if they don't exist
mkdir -p ${PROJECT_DIR}/dist
mkdir -p /var/log/nginx/${PROJECT_NAME}

# Set proper permissions
chown -R www-data:www-data ${PROJECT_DIR}/dist
chmod -R 755 ${PROJECT_DIR}/dist

# Configure Nginx if not already configured
if [ ! -f "${NGINX_SITES_AVAILABLE}/${PROJECT_NAME}" ]; then
    echo "Creating Nginx configuration..."
    cat > ${NGINX_SITES_AVAILABLE}/${PROJECT_NAME} << 'EOF'
server {
    listen 80;
    server_name your-domain.com www.your-domain.com;

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
EOF

    # Enable the site
    ln -sf ${NGINX_SITES_AVAILABLE}/${PROJECT_NAME} ${NGINX_SITES_ENABLED}/${PROJECT_NAME}
    echo "Nginx configuration created and enabled"
fi

# Test Nginx configuration
echo "Testing Nginx configuration..."
nginx -t

# Reload Nginx
echo "Reloading Nginx..."
systemctl reload nginx

echo "========================================="
echo "Deployment completed successfully!"
echo "========================================="
echo "Project: ${PROJECT_NAME}"
echo "Location: ${PROJECT_DIR}"
echo "Web root: ${PROJECT_DIR}/dist"
echo "========================================="
