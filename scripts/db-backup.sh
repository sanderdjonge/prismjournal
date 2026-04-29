#!/bin/sh
# PrismJournal Database Backup Script
# Runs inside the backup container. Sources /etc/backup.env for config.
# Stores backups to /backups/hourly, /daily, /weekly with rotation.
# Optionally uploads to S3/R2 if S3_BUCKET is set.

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

# Optional S3 upload
if [ -n "$S3_BUCKET" ]; then
    S3_KEY="backups/hourly/backup_${TIMESTAMP}.dump"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Uploading to S3: s3://${S3_BUCKET}/${S3_KEY}"

    if command -v aws >/dev/null 2>&1; then
        AWS_ENDPOINT_FLAG=""
        if [ -n "$S3_ENDPOINT" ]; then
            AWS_ENDPOINT_FLAG="--endpoint-url $S3_ENDPOINT"
        fi

        AWS_REGION_FLAG=""
        if [ -n "$S3_REGION" ]; then
            AWS_REGION_FLAG="--region $S3_REGION"
        fi

        if aws s3 cp "$BACKUP_FILE" "s3://${S3_BUCKET}/${S3_KEY}" \
            $AWS_ENDPOINT_FLAG $AWS_REGION_FLAG 2>/dev/null; then
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] S3 upload complete"
        else
            echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] S3 upload failed"
        fi
    else
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] aws CLI not available, skipping S3 upload"
    fi
fi

# Midnight → promote to daily
if [ "$HOUR" = "00" ]; then
    DAILY_FILE="$BACKUP_DIR/daily/backup_$(date -u +%Y%m%d).dump"
    cp "$BACKUP_FILE" "$DAILY_FILE"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Promoted to daily: $DAILY_FILE"

    # Upload daily backup to S3
    if [ -n "$S3_BUCKET" ]; then
        DAILY_S3_KEY="backups/daily/backup_$(date -u +%Y%m%d).dump"
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Uploading daily backup to S3: s3://${S3_BUCKET}/${DAILY_S3_KEY}"

        if command -v aws >/dev/null 2>&1; then
            AWS_ENDPOINT_FLAG=""
            if [ -n "$S3_ENDPOINT" ]; then
                AWS_ENDPOINT_FLAG="--endpoint-url $S3_ENDPOINT"
            fi

            AWS_REGION_FLAG=""
            if [ -n "$S3_REGION" ]; then
                AWS_REGION_FLAG="--region $S3_REGION"
            fi

            aws s3 cp "$DAILY_FILE" "s3://${S3_BUCKET}/${DAILY_S3_KEY}" \
                $AWS_ENDPOINT_FLAG $AWS_REGION_FLAG 2>/dev/null || \
                echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Daily S3 upload failed"
        fi
    fi
fi

# Sunday midnight → promote to weekly
if [ "$HOUR" = "00" ] && [ "$DOW" = "7" ]; then
    WEEKLY_FILE="$BACKUP_DIR/weekly/backup_$(date -u +%Y%m%d).dump"
    cp "$BACKUP_FILE" "$WEEKLY_FILE"
    echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Promoted to weekly: $WEEKLY_FILE"

    # Upload weekly backup to S3
    if [ -n "$S3_BUCKET" ]; then
        WEEKLY_S3_KEY="backups/weekly/backup_$(date -u +%Y%m%d).dump"
        echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Uploading weekly backup to S3: s3://${S3_BUCKET}/${WEEKLY_S3_KEY}"

        if command -v aws >/dev/null 2>&1; then
            AWS_ENDPOINT_FLAG=""
            if [ -n "$S3_ENDPOINT" ]; then
                AWS_ENDPOINT_FLAG="--endpoint-url $S3_ENDPOINT"
            fi

            AWS_REGION_FLAG=""
            if [ -n "$S3_REGION" ]; then
                AWS_REGION_FLAG="--region $S3_REGION"
            fi

            aws s3 cp "$WEEKLY_FILE" "s3://${S3_BUCKET}/${WEEKLY_S3_KEY}" \
                $AWS_ENDPOINT_FLAG $AWS_REGION_FLAG 2>/dev/null || \
                echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Weekly S3 upload failed"
        fi
    fi
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
