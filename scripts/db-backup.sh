#!/bin/sh
# PrismJournal Database Backup Script
# Runs inside the backup container. Sources /etc/backup.env for config.
# Stores backups to /backups/hourly, /daily, /weekly with rotation.

set -e

# Load environment
if [ -f /etc/backup.env ]; then
    # shellcheck disable=SC1091
    . /etc/backup.env
fi

BACKUP_DIR="${BACKUP_DIR:-/backups}"
KEEP_HOURLY="${BACKUP_KEEP_HOURLY:-24}"
KEEP_DAILY="${BACKUP_KEEP_DAILY:-30}"
KEEP_WEEKLY="${BACKUP_KEEP_WEEKLY:-12}"

TIMESTAMP=$(date -u +%Y%m%d_%H%M%S)
HOUR=$(date -u +%H)
DOW=$(date -u +%u)   # 1=Mon 7=Sun

mkdir -p "$BACKUP_DIR/hourly" "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

BACKUP_FILE="$BACKUP_DIR/hourly/backup_${TIMESTAMP}.dump"

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Starting backup → $BACKUP_FILE"

pg_dump \
    --host="$PGHOST" \
    --port="${PGPORT:-5432}" \
    --username="$PGUSER" \
    --dbname="$PGDATABASE" \
    --format=custom \
    --no-owner \
    --no-acl \
    --file="$BACKUP_FILE"

SIZE=$(ls -lh "$BACKUP_FILE" | awk '{print $5}')
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup complete: $SIZE"

# Midnight → promote to daily
if [ "$HOUR" = "00" ]; then
    DAILY_FILE="$BACKUP_DIR/daily/backup_$(date -u +%Y%m%d).dump"
    cp "$BACKUP_FILE" "$DAILY_FILE"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Promoted to daily: $DAILY_FILE"
fi

# Sunday midnight → promote to weekly
if [ "$HOUR" = "00" ] && [ "$DOW" = "7" ]; then
    WEEKLY_FILE="$BACKUP_DIR/weekly/backup_$(date -u +%Y%m%d).dump"
    cp "$BACKUP_FILE" "$WEEKLY_FILE"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Promoted to weekly: $WEEKLY_FILE"
fi

# Rotation
HOURLY_BEFORE=$(ls "$BACKUP_DIR/hourly/"*.dump 2>/dev/null | wc -l)
ls -t "$BACKUP_DIR/hourly/"*.dump 2>/dev/null | tail -n "+$((KEEP_HOURLY + 1))" | xargs rm -f 2>/dev/null || true
DAILY_BEFORE=$(ls "$BACKUP_DIR/daily/"*.dump 2>/dev/null | wc -l)
ls -t "$BACKUP_DIR/daily/"*.dump 2>/dev/null | tail -n "+$((KEEP_DAILY + 1))" | xargs rm -f 2>/dev/null || true
WEEKLY_BEFORE=$(ls "$BACKUP_DIR/weekly/"*.dump 2>/dev/null | wc -l)
ls -t "$BACKUP_DIR/weekly/"*.dump 2>/dev/null | tail -n "+$((KEEP_WEEKLY + 1))" | xargs rm -f 2>/dev/null || true

HOURLY_AFTER=$(ls "$BACKUP_DIR/hourly/"*.dump 2>/dev/null | wc -l)
DAILY_AFTER=$(ls "$BACKUP_DIR/daily/"*.dump 2>/dev/null | wc -l)
WEEKLY_AFTER=$(ls "$BACKUP_DIR/weekly/"*.dump 2>/dev/null | wc -l)

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Rotation: hourly=$HOURLY_AFTER/$KEEP_HOURLY daily=$DAILY_AFTER/$KEEP_DAILY weekly=$WEEKLY_AFTER/$KEEP_WEEKLY"
