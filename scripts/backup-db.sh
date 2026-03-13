#!/bin/bash
# Database Backup Script for PrismJournal
# Usage: ./scripts/backup-db.sh [reason]
# Example: ./scripts/backup-db.sh before_schema_change

set -e

# Configuration
BACKUP_DIR="./backups"
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
REASON="${1:-manual}"
BACKUP_FILE="${BACKUP_DIR}/db_backup_${TIMESTAMP}_${REASON}.sql"

# Create backup directory if it doesn't exist
mkdir -p "$BACKUP_DIR"

echo "Creating database backup..."
echo "Reason: $REASON"
echo "File: $BACKUP_FILE"

# Run pg_dump inside the Docker container
docker compose exec -T db pg_dump -U prism_user -d prism_journal --clean --if-exists > "$BACKUP_FILE"

# Compress the backup
gzip "$BACKUP_FILE"

echo "✅ Database backup created: ${BACKUP_FILE}.gz"

# List recent backups
echo ""
echo "Recent backups:"
ls -la "$BACKUP_DIR"/*.sql.gz 2>/dev/null | tail -5 || echo "No backups found"
