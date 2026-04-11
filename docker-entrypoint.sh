#!/bin/sh
set -e

echo "Running Prisma migrations..."
npx prisma migrate deploy --schema=./prisma/schema.prisma || echo "WARNING: Prisma migration failed, continuing startup..."

echo "Starting PrismJournal..."
export HOSTNAME=0.0.0.0
exec node server.js
