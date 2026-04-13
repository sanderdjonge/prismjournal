#!/bin/sh
set -e

echo "Running Prisma migrations..."
if ! prisma migrate deploy --schema=./prisma/schema.prisma; then
  echo "FATAL: Prisma migration failed. Container will exit." >&2
  exit 1
fi

echo "Starting PrismJournal..."
export HOSTNAME=0.0.0.0
exec node server.js
