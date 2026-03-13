#!/bin/bash
# Combined Backup Script for PrismJournal
# Backs up both database and .env file
# Usage: ./scripts/backup-all.sh [reason]
# Example: ./scripts/backup-all.sh before_migration

set -e

REASON="${1:-manual}"

echo "=========================================="
echo "PrismJournal Backup Script"
echo "=========================================="
echo ""

# Run database backup
echo "1. Backing up database..."
./scripts/backup-db.sh "$REASON"
echo ""

# Run .env backup
echo "2. Backing up .env file..."
./scripts/backup-env.sh "$REASON"
echo ""

echo "=========================================="
echo "✅ All backups completed successfully!"
echo "=========================================="
