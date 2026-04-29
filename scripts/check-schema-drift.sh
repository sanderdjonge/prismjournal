#!/bin/bash
# check-schema-drift.sh — Detect Prisma schema changes without migrations.
# Run this before commits that modify prisma/schema.prisma.
# Usage: ./scripts/check-schema-drift.sh
#
# Exits with code 1 if schema.prisma was modified but no new migration was created.
# This prevents the "db push without migration" pattern that caused data loss.

set -e

SCHEMA_FILE="prisma/schema.prisma"
MIGRATIONS_DIR="prisma/migrations"

if ! git diff --cached --name-only | grep -q "$SCHEMA_FILE"; then
  # Schema not modified in this commit — OK
  exit 0
fi

# Schema was modified. Check if a new migration was also added.
NEW_MIGRATIONS=$(git diff --cached --name-only | grep "$MIGRATIONS_DIR" | grep -v lock | wc -l | tr -d ' ')

if [ "$NEW_MIGRATIONS" -eq 0 ]; then
  echo ""
  echo "⛔  BLOCKED: prisma/schema.prisma was modified but no migration file was added."
  echo ""
  echo "   This project enforces that ALL schema changes must have a corresponding migration."
  echo "   Using 'db push' without a migration causes schema drift that breaks deployments."
  echo ""
  echo "   To fix, run:"
  echo "     npx prisma migrate dev --name your_migration_description"
  echo ""
  echo "   If this is a cosmetic change (formatting only), use --no-verify to skip this check."
  echo ""
  exit 1
fi

echo "✅ Schema change detected with $NEW_MIGRATIONS new migration(s). Good."
exit 0
