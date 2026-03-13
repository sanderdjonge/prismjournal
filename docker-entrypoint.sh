#!/bin/sh
set -e

echo "Running Prisma migrations..."
prisma migrate deploy --schema=./prisma/schema.prisma

echo "Starting PrismJournal..."
exec node server.js
