#!/bin/sh
# Backup service entrypoint — runs inside the postgres:15-alpine backup container.
# 1. Writes env vars to /etc/backup.env (crond doesn't inherit environment)
# 2. Runs an immediate backup
# 3. Starts crond for hourly backups
# Output goes to stdout so `docker logs prism-dev-backup` works.

set -e

BACKUP_DIR="${BACKUP_DIR:-/backups}"

mkdir -p "$BACKUP_DIR/hourly" "$BACKUP_DIR/daily" "$BACKUP_DIR/weekly"

# Write env file so crond jobs can source it
cat > /etc/backup.env << EOF
PGHOST=${PGHOST}
PGPORT=${PGPORT:-5432}
PGUSER=${PGUSER}
PGPASSWORD=${PGPASSWORD}
PGDATABASE=${PGDATABASE}
BACKUP_DIR=${BACKUP_DIR}
BACKUP_KEEP_HOURLY=${BACKUP_KEEP_HOURLY:-24}
BACKUP_KEEP_DAILY=${BACKUP_KEEP_DAILY:-30}
BACKUP_KEEP_WEEKLY=${BACKUP_KEEP_WEEKLY:-12}
EOF
chmod 600 /etc/backup.env

# Crontab: run every hour, output to stdout of PID 1 for docker logs
cat > /etc/crontabs/root << EOF
0 * * * * /scripts/db-backup.sh > /proc/1/fd/1 2>&1
EOF

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Backup service starting (db=$PGHOST/$PGDATABASE)"
echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Running initial backup..."

/scripts/db-backup.sh

echo "[$(date -u +%Y-%m-%dT%H:%M:%SZ)] Initial backup done. Cron scheduled every hour."

exec crond -f -l 6
