#!/bin/sh
set -e

echo "Running Prisma migrations..."

# Pre-migration backup safeguard: dump the DB before running migrations
# so we can recover if a migration goes wrong.
if [ -n "$BACKUP_PATH" ]; then
  BACKUP_FILE="$BACKUP_PATH/pre-migrate-$(date +%Y%m%d_%H%M%S).dump"
  mkdir -p "$BACKUP_PATH"
  if pg_dump -U "$POSTGRES_USER" -d "$POSTGRES_DB" -Fc > "$BACKUP_FILE" 2>/dev/null; then
    echo "Pre-migration backup saved: $BACKUP_FILE"
  else
    echo "WARNING: Pre-migration backup failed (pg_dump not available or DB unreachable). Continuing..."
  fi
fi

if ! prisma migrate deploy --schema=./prisma/schema.prisma; then
  echo "FATAL: Prisma migration failed. Container will exit." >&2
  echo "A pre-migration backup may be available at $BACKUP_PATH/pre-migrate-*.dump" >&2
  exit 1
fi

echo "Starting PrismJournal..."
export HOSTNAME=0.0.0.0
exec node server.js
