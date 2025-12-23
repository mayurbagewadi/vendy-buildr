#!/bin/bash
# ============================================================================
# SUPABASE DATABASE BACKUP SCRIPT FOR HOSTINGER VPS
# ============================================================================
# This script backs up your Supabase database to the VPS local disk
#
# FEATURES:
# - Runs every 6 hours (via cron job)
# - Creates timestamped backups
# - Compresses backups to save disk space
# - Keeps backups for 30 days (auto-cleanup)
# - Logs all operations
# - Email notification on failure (optional)
# ============================================================================

# Configuration
BACKUP_DIR="/home/backups/database"  # Change this to your VPS path
LOG_FILE="/home/backups/backup.log"
RETENTION_DAYS=30

# Supabase database connection (REPLACE WITH YOUR ACTUAL DATABASE URL)
# Format: postgresql://postgres:[PASSWORD]@db.[PROJECT-REF].supabase.co:5432/postgres
DB_URL="postgresql://postgres:YOUR_PASSWORD@db.YOUR_PROJECT_REF.supabase.co:5432/postgres"

# ============================================================================
# DO NOT EDIT BELOW THIS LINE (unless you know what you're doing)
# ============================================================================

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"
mkdir -p "$(dirname "$LOG_FILE")"

# Log function
log() {
    echo "[$(date '+%Y-%m-%d %H:%M:%S')] $1" | tee -a "$LOG_FILE"
}

log "=========================================="
log "Starting database backup..."

# Generate backup filename with timestamp
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/backup_$TIMESTAMP.sql"
COMPRESSED_FILE="$BACKUP_FILE.gz"

# Check if PostgreSQL client is installed
if ! command -v pg_dump &> /dev/null; then
    log "ERROR: pg_dump is not installed. Installing PostgreSQL client..."

    # Install PostgreSQL client (for Ubuntu/Debian)
    if command -v apt-get &> /dev/null; then
        sudo apt-get update
        sudo apt-get install -y postgresql-client
    elif command -v yum &> /dev/null; then
        sudo yum install -y postgresql
    else
        log "ERROR: Cannot install PostgreSQL client automatically. Please install manually."
        exit 1
    fi
fi

# Create the backup
log "Creating backup: $BACKUP_FILE"
pg_dump "$DB_URL" \
    --format=plain \
    --no-owner \
    --no-acl \
    --file="$BACKUP_FILE" 2>&1 | tee -a "$LOG_FILE"

# Check if backup was successful
if [ $? -eq 0 ] && [ -f "$BACKUP_FILE" ]; then
    log "✓ Backup created successfully"

    # Compress the backup
    log "Compressing backup..."
    gzip "$BACKUP_FILE"

    if [ -f "$COMPRESSED_FILE" ]; then
        BACKUP_SIZE=$(du -h "$COMPRESSED_FILE" | cut -f1)
        log "✓ Backup compressed: $COMPRESSED_FILE ($BACKUP_SIZE)"
    else
        log "WARNING: Compression failed, keeping uncompressed backup"
    fi
else
    log "ERROR: Backup failed!"

    # Optional: Send email notification
    # echo "Database backup failed at $(date)" | mail -s "Backup Failed" your@email.com

    exit 1
fi

# Cleanup old backups (keep last 30 days)
log "Cleaning up old backups (keeping last $RETENTION_DAYS days)..."
find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f -mtime +$RETENTION_DAYS -exec rm -f {} \;
find "$BACKUP_DIR" -name "backup_*.sql" -type f -mtime +$RETENTION_DAYS -exec rm -f {} \;

BACKUP_COUNT=$(find "$BACKUP_DIR" -name "backup_*.sql.gz" -type f | wc -l)
log "✓ Cleanup completed. Total backups: $BACKUP_COUNT"

# Show disk usage
DISK_USAGE=$(du -sh "$BACKUP_DIR" | cut -f1)
log "Backup directory size: $DISK_USAGE"

log "Backup completed successfully!"
log "=========================================="

exit 0
