#!/bin/bash
# PrismJournal Database Restore Script
# Usage: ./scripts/db-restore.sh [path/to/backup.dump]
# Without arguments: lists available backups and prompts.

set -e

BACKUP_DIR="./backups"
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m'

# Detect running environment
if docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^prism-dev-db$"; then
    CONTAINER="prism-dev-db"
    DB_USER="prism_dev"
    DB_NAME="prism_journal_dev"
    ENV_LABEL="DEV"
elif docker ps --format '{{.Names}}' 2>/dev/null | grep -q "^prism-prod-db$"; then
    CONTAINER="prism-prod-db"
    DB_USER="${POSTGRES_USER:-prism_user}"
    DB_NAME="${POSTGRES_DB:-prism_journal}"
    ENV_LABEL="PROD"
else
    echo -e "${RED}Error: No PrismJournal database container is running.${NC}"
    echo "Start the stack first: docker compose -f docker-compose.dev.yml up -d"
    exit 1
fi

# Pick backup file
if [ -n "$1" ]; then
    BACKUP_FILE="$1"
else
    echo "Available backups:"
    echo ""
    echo "--- HOURLY (last 5) ---"
    ls -lt "$BACKUP_DIR/hourly/"*.dump 2>/dev/null | head -5 | awk '{print $6, $7, $8, $9}' || echo "  (none)"
    echo ""
    echo "--- DAILY (last 5) ---"
    ls -lt "$BACKUP_DIR/daily/"*.dump 2>/dev/null | head -5 | awk '{print $6, $7, $8, $9}' || echo "  (none)"
    echo ""
    echo "--- WEEKLY ---"
    ls -lt "$BACKUP_DIR/weekly/"*.dump 2>/dev/null | awk '{print $6, $7, $8, $9}' || echo "  (none)"
    echo ""
    read -rp "Enter backup file path: " BACKUP_FILE
fi

if [ ! -f "$BACKUP_FILE" ]; then
    echo -e "${RED}Error: File not found: $BACKUP_FILE${NC}"
    exit 1
fi

FILE_SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo ""
echo -e "${YELLOW}⚠️  WARNING: This will overwrite the ${ENV_LABEL} database (${DB_NAME}).${NC}"
echo "   Container : $CONTAINER"
echo "   Backup    : $BACKUP_FILE ($FILE_SIZE)"
echo ""
read -rp "Type 'yes' to confirm: " CONFIRM
if [ "$CONFIRM" != "yes" ]; then
    echo "Aborted."
    exit 0
fi

echo ""
echo "Copying backup to container..."
docker cp "$BACKUP_FILE" "$CONTAINER:/tmp/restore.dump"

echo "Restoring..."
docker exec "$CONTAINER" pg_restore \
    -U "$DB_USER" \
    -d "$DB_NAME" \
    --no-owner \
    --no-acl \
    --clean \
    --if-exists \
    /tmp/restore.dump

docker exec "$CONTAINER" rm /tmp/restore.dump

echo ""
echo -e "${GREEN}✅ Restore complete!${NC}"
echo ""

# Show row counts as sanity check
echo "Database row counts:"
docker exec "$CONTAINER" psql -U "$DB_USER" -d "$DB_NAME" -c \
    'SELECT schemaname, tablename, n_live_tup AS rows FROM pg_stat_user_tables ORDER BY n_live_tup DESC LIMIT 10;' \
    2>/dev/null || true
